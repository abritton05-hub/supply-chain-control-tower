'use server';

import { logActivity } from '@/lib/activity/log-activity';
import { getCurrentUserEmail } from '@/lib/auth/session';
import { supabaseServer } from '@/lib/supabase/server';
import type { ImportPreview } from '@/lib/import-workflow/types';
import {
  buildReceivingPreview,
  type ReceivingMatch,
} from './receiving-import';
import type { ReceivingImportInput } from './types';

type ReceiveInput = {
  item_id?: string;
  part_number?: string;
  quantity: number;
  reference?: string;
  notes?: string;
  performed_by?: string;
};

type PreviewResult =
  | {
      ok: true;
      message: string;
      preview: ImportPreview<ReceivingImportInput>;
    }
  | {
      ok: false;
      message: string;
      preview?: ImportPreview<ReceivingImportInput>;
    };

type BulkImportResult = {
  ok: boolean;
  message: string;
  skipReasons?: string[];
};

type InventoryLookupRow = {
  item_id: string;
  part_number: string | null;
  description: string | null;
};

function clean(value: string | null | undefined) {
  return value?.trim() || '';
}

async function loadInventoryLookup() {
  const supabase = await supabaseServer();

  const { data, error } = await supabase
    .from('inventory')
    .select('item_id,part_number,description')
    .order('item_id', { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as InventoryLookupRow[];
}

function buildMatchFinder(inventory: InventoryLookupRow[]) {
  const byItemId = new Map<string, InventoryLookupRow>();
  const byPartNumber = new Map<string, InventoryLookupRow>();

  for (const row of inventory) {
    const itemId = clean(row.item_id).toLowerCase();
    const partNumber = clean(row.part_number).toLowerCase();

    if (itemId) {
      byItemId.set(itemId, row);
    }

    if (partNumber && !byPartNumber.has(partNumber)) {
      byPartNumber.set(partNumber, row);
    }
  }

  return (row: ReceivingImportInput): ReceivingMatch | undefined => {
    const itemId = clean(row.item_id).toLowerCase();
    const partNumber = clean(row.part_number).toLowerCase();

    if (itemId && byItemId.has(itemId)) {
      const match = byItemId.get(itemId)!;

      return {
        match_type: 'item_id',
        target_item_id: match.item_id,
        target_part_number: match.part_number,
        target_description: match.description,
      };
    }

    if (partNumber && byPartNumber.has(partNumber)) {
      const match = byPartNumber.get(partNumber)!;

      return {
        match_type: 'part_number',
        target_item_id: match.item_id,
        target_part_number: match.part_number,
        target_description: match.description,
      };
    }

    return undefined;
  };
}

export async function receiveInventoryItem(input: ReceiveInput) {
  const supabase = await supabaseServer();

  try {
    const rawItemId = clean(input.item_id);
    const rawPartNumber = clean(input.part_number);
    const quantity = Number(input.quantity);
    const currentUserEmail = await getCurrentUserEmail();
    const performedBy = clean(input.performed_by) || currentUserEmail || 'unknown';

    if (!rawItemId && !rawPartNumber) {
      return {
        ok: false,
        message: 'Select an inventory item first.',
      };
    }

    if (!Number.isFinite(quantity) || quantity <= 0) {
      return {
        ok: false,
        message: 'Quantity must be greater than 0.',
      };
    }

    let resolvedItemId = rawItemId;
    let resolvedPartNumber = rawPartNumber;

    if (!resolvedItemId && resolvedPartNumber) {
      const { data: inventoryMatch, error: inventoryMatchError } = await supabase
        .from('inventory')
        .select('item_id,part_number')
        .eq('part_number', resolvedPartNumber)
        .limit(1)
        .maybeSingle();

      if (inventoryMatchError) {
        return {
          ok: false,
          message: `Could not resolve part number: ${inventoryMatchError.message}`,
        };
      }

      if (!inventoryMatch?.item_id) {
        return {
          ok: false,
          message: `No inventory item found for part number ${resolvedPartNumber}.`,
        };
      }

      resolvedItemId = inventoryMatch.item_id;
      resolvedPartNumber = inventoryMatch.part_number ?? resolvedPartNumber;
    }

    const { data: transactionId, error } = await supabase.rpc('receive_inventory_item', {
      p_item_id: resolvedItemId,
      p_quantity: quantity,
      p_reference: clean(input.reference) || null,
      p_notes: clean(input.notes) || null,
      p_performed_by: performedBy,
    });

    if (error) {
      return {
        ok: false,
        message: `Receipt failed: ${error.message}`,
      };
    }

    if (!transactionId) {
      return {
        ok: false,
        message:
          'Receipt failed: No transaction ID returned. The inventory item was not matched by the RPC.',
      };
    }

    const activity = await logActivity({
      entityType: 'inventory_transaction',
      entityId: String(transactionId),
      actionType: 'RECEIPT_POSTED',
      title: `Receipt posted for ${resolvedPartNumber || resolvedItemId}`,
      details: {
        item_id: resolvedItemId,
        part_number: resolvedPartNumber || null,
        quantity,
        reference: clean(input.reference) || null,
        notes: clean(input.notes) || null,
      },
      referenceNumber: clean(input.reference) || resolvedItemId || null,
      userName: performedBy,
    });

    if (!activity.ok) {
      return {
        ok: true,
        message: 'Receipt posted, but activity logging failed.',
        transactionId: String(transactionId),
      };
    }

    return {
      ok: true,
      message: 'Receipt posted successfully.',
      transactionId: String(transactionId),
    };
  } catch (err: any) {
    return {
      ok: false,
      message: err?.message || 'Unexpected error posting receipt.',
    };
  }
}

export async function previewReceivingImport(
  rows: ReceivingImportInput[]
): Promise<PreviewResult> {
  try {
    if (!rows.length) {
      return {
        ok: false,
        message: 'No receiving rows found to preview.',
      };
    }

    const inventory = await loadInventoryLookup();
    const findMatch = buildMatchFinder(inventory);
    const preview = buildReceivingPreview({ rows, findMatch });

    const matchedRows = preview.summary.updates + preview.summary.newRecords;
    const unresolvedRows = preview.summary.incompleteUsable;
    const invalidRows = preview.summary.skippedInvalid + preview.summary.skippedBlank;

    return {
      ok: true,
      message: `${matchedRows} matched, ${unresolvedRows} unresolved, ${invalidRows} skipped.`,
      preview,
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : 'Failed to preview receiving import.',
    };
  }
}

export async function importReceivingReceipts(
  rows: ReceivingImportInput[]
): Promise<BulkImportResult> {
  try {
    if (!rows.length) {
      return {
        ok: false,
        message: 'No receiving rows found to import.',
      };
    }

    const previewResult = await previewReceivingImport(rows);

    if (!previewResult.ok || !previewResult.preview) {
      return {
        ok: false,
        message: previewResult.message,
      };
    }

    const postableRows = previewResult.preview.rows.filter(
      (row) => row.status === 'update' || row.status === 'insert'
    );

    if (!postableRows.length) {
      return {
        ok: false,
        message: 'No matched receipt rows were eligible to post.',
        skipReasons: previewResult.preview.skipReasons
          .map((reason) => `Row ${reason.rowNumber}: ${reason.reason}`)
          .slice(0, 12),
      };
    }

    const skipReasons: string[] = [];
    let postedCount = 0;

    for (const row of postableRows) {
      const result = await receiveInventoryItem({
        item_id: row.record.target_item_id || row.record.item_id,
        part_number: row.record.target_part_number || row.record.part_number,
        quantity: Number(row.record.quantity) || 0,
        reference: row.record.reference,
        notes: row.record.notes,
        performed_by: row.record.performed_by,
      });

      if (result.ok) {
        postedCount += 1;
      } else {
        skipReasons.push(`Row ${row.rowNumber}: ${result.message}`);
      }
    }

    if (postedCount === 0) {
      return {
        ok: false,
        message: 'No receipts were posted.',
        skipReasons: skipReasons.slice(0, 12),
      };
    }

    const unresolvedReasons = previewResult.preview.rows
      .filter((row) => row.status === 'incomplete' || row.status === 'skipped')
      .flatMap((row) => row.reasons.map((reason) => `Row ${row.rowNumber}: ${reason}`));

    return {
      ok: true,
      message: `${postedCount} receipt row${postedCount === 1 ? '' : 's'} posted successfully.`,
      skipReasons: [...skipReasons, ...unresolvedReasons].slice(0, 12),
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : 'Failed to import receiving receipts.',
    };
  }
}

export const postReceipt = receiveInventoryItem;