'use server';

import { getCurrentUserEmail } from '@/lib/auth/session';
import { getCurrentUserProfile } from '@/lib/auth/profile';
import { canReceiveInventory } from '@/lib/auth/roles';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { supabaseServer } from '@/lib/supabase/server';
import { logTransaction } from '@/lib/transactions/log-transaction';
import type { ImportPreview } from '@/lib/import-workflow/types';
import { buildReceivingPreview, type ReceivingMatch } from './receiving-import';
import type { ReceivingImportInput } from './types';

const SUPPLY_CATEGORY = 'Supply';
const SUPPLY_LOCATION = 'SUPPLY';
const SUPPLY_SITE = 'SEA991';

type ReceiveInput = {
  item_id?: string;
  part_number?: string;
  description?: string;
  quantity: number;
  reference?: string;
  notes?: string;
  performed_by?: string;
  is_supply?: boolean;
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
  id?: string;
  item_id: string;
  part_number: string | null;
  description: string | null;
  is_supply?: boolean | null;
};

type ReceiptResolution = {
  itemId: string;
  partNumber: string;
  description: string;
  isSupply: boolean;
};

type InventoryLocation = {
  location: string | null;
  site: string | null;
  bin_location: string | null;
};

function clean(value: string | null | undefined) {
  return value?.trim() || '';
}

function supplyItemId(partNumber: string, description: string) {
  const seed = clean(partNumber) || clean(description) || `SUPPLY-${Date.now()}`;
  const normalized = seed
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 36);

  return `SUPPLY-${normalized || Date.now()}`;
}

function locationText(row: InventoryLocation | null | undefined) {
  if (!row) return null;
  return [clean(row.site || row.location), clean(row.bin_location)].filter(Boolean).join(' / ') || null;
}

async function requireReceivingAccess() {
  const profile = await getCurrentUserProfile();

  if (!canReceiveInventory(profile.role)) {
    throw new Error('You do not have permission to receive inventory.');
  }
}

async function ensureReceiptTransactionLocation(
  supabase: Awaited<ReturnType<typeof supabaseAdmin>>,
  transactionId: string,
  itemId: string
) {
  const { data: transaction, error: transactionError } = await supabase
    .from('inventory_transactions')
    .select('to_location')
    .eq('id', transactionId)
    .maybeSingle();

  if (transactionError || transaction?.to_location) {
    return;
  }

  const { data: inventoryLocation, error: inventoryError } = await supabase
    .from('inventory')
    .select('location,site,bin_location')
    .eq('item_id', itemId)
    .maybeSingle();

  if (inventoryError) {
    console.error('Receiving transaction location lookup failed.', {
      transactionId,
      itemId,
      message: inventoryError.message,
    });
    return;
  }

  const toLocation = locationText(inventoryLocation as InventoryLocation | null);
  if (!toLocation) return;

  const { error: updateError } = await supabase
    .from('inventory_transactions')
    .update({ to_location: toLocation })
    .eq('id', transactionId);

  if (updateError) {
    console.error('Receiving transaction location update failed.', {
      transactionId,
      itemId,
      message: updateError.message,
    });
  }
}

async function loadInventoryLookup() {
  const supabase = await supabaseServer();

  const { data, error } = await supabase
    .from('inventory')
    .select('id,item_id,part_number,description,is_supply')
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

async function resolveSupplyReceipt(
  supabase: Awaited<ReturnType<typeof supabaseAdmin>>,
  input: ReceiveInput
): Promise<ReceiptResolution> {
  const description = clean(input.description);
  const partNumber = clean(input.part_number);

  if (!description && !partNumber) {
    throw new Error('Supply receipts need a description or part number.');
  }

  if (partNumber) {
    const { data: supplyByPart, error: supplyByPartError } = await supabase
      .from('inventory')
      .select('item_id,part_number,description,is_supply')
      .eq('part_number', partNumber)
      .eq('is_supply', true)
      .limit(1)
      .maybeSingle();

    if (supplyByPartError) {
      throw new Error(`Could not resolve supply item: ${supplyByPartError.message}`);
    }

    if (supplyByPart?.item_id) {
      return {
        itemId: supplyByPart.item_id,
        partNumber: supplyByPart.part_number ?? partNumber,
        description: (supplyByPart.description ?? description) || supplyByPart.item_id,
        isSupply: true,
      };
    }
  }

  if (description) {
    const { data: supplyByDescription, error: supplyByDescriptionError } = await supabase
      .from('inventory')
      .select('item_id,part_number,description,is_supply')
      .eq('description', description)
      .eq('is_supply', true)
      .limit(1)
      .maybeSingle();

    if (supplyByDescriptionError) {
      throw new Error(`Could not resolve supply item: ${supplyByDescriptionError.message}`);
    }

    if (supplyByDescription?.item_id) {
      return {
        itemId: supplyByDescription.item_id,
        partNumber:
          (supplyByDescription.part_number ?? partNumber) || supplyByDescription.item_id,
        description: supplyByDescription.description ?? description,
        isSupply: true,
      };
    }
  }

  const itemId = supplyItemId(partNumber, description);
  const { data: insertedSupply, error: insertSupplyError } = await supabase
    .from('inventory')
    .insert({
      item_id: itemId,
      part_number: partNumber || itemId,
      description: description || partNumber || itemId,
      category: SUPPLY_CATEGORY,
      location: SUPPLY_LOCATION,
      qty_on_hand: 0,
      reorder_point: 0,
      is_supply: true,
      site: SUPPLY_SITE,
    })
    .select('item_id,part_number,description,is_supply')
    .single();

  if (insertSupplyError || !insertedSupply?.item_id) {
    throw new Error(insertSupplyError?.message || 'Could not create supply inventory item.');
  }

  return {
    itemId: insertedSupply.item_id,
    partNumber: (insertedSupply.part_number ?? partNumber) || insertedSupply.item_id,
    description: (insertedSupply.description ?? description) || insertedSupply.item_id,
    isSupply: true,
  };
}

async function resolveStandardReceipt(
  supabase: Awaited<ReturnType<typeof supabaseAdmin>>,
  input: ReceiveInput
): Promise<ReceiptResolution> {
  const rawItemId = clean(input.item_id);
  const rawPartNumber = clean(input.part_number);
  const rawDescription = clean(input.description);

  if (!rawItemId && !rawPartNumber) {
    throw new Error('Select an inventory item first.');
  }

  let resolvedItemId = rawItemId;
  let resolvedPartNumber = rawPartNumber;
  let resolvedDescription = rawDescription;

  if (!resolvedItemId && resolvedPartNumber) {
    const { data: inventoryMatch, error: inventoryMatchError } = await supabase
      .from('inventory')
      .select('item_id,part_number,description,is_supply')
      .eq('part_number', resolvedPartNumber)
      .limit(1)
      .maybeSingle();

    if (inventoryMatchError) {
      throw new Error(`Could not resolve part number: ${inventoryMatchError.message}`);
    }

    if (!inventoryMatch?.item_id) {
      throw new Error(`No inventory item found for part number ${resolvedPartNumber}.`);
    }

    resolvedItemId = inventoryMatch.item_id;
    resolvedPartNumber = inventoryMatch.part_number ?? resolvedPartNumber;
    resolvedDescription = inventoryMatch.description ?? resolvedDescription;
  }

  return {
    itemId: resolvedItemId,
    partNumber: resolvedPartNumber || resolvedItemId,
    description: resolvedDescription || resolvedPartNumber || resolvedItemId,
    isSupply: false,
  };
}

async function resolveReceiptTarget(
  supabase: Awaited<ReturnType<typeof supabaseAdmin>>,
  input: ReceiveInput
): Promise<ReceiptResolution> {
  if (input.is_supply) {
    return resolveSupplyReceipt(supabase, input);
  }

  return resolveStandardReceipt(supabase, input);
}

export async function receiveInventoryItem(input: ReceiveInput) {
  try {
    await requireReceivingAccess();

    const supabase = await supabaseAdmin();
    const quantity = Number(input.quantity);
    const currentUserEmail = await getCurrentUserEmail();
    const performedBy = clean(input.performed_by) || currentUserEmail || 'unknown';

    if (!Number.isFinite(quantity) || quantity <= 0) {
      return {
        ok: false,
        message: 'Quantity must be greater than 0.',
      };
    }

    const resolved = await resolveReceiptTarget(supabase, input);

    const { data: transactionId, error } = await supabase.rpc('receive_inventory_item', {
      p_item_id: resolved.itemId,
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

    await ensureReceiptTransactionLocation(supabase, String(transactionId), resolved.itemId);

    const activity = await logTransaction({
      transaction_type: 'RECEIPT',
      item_id: resolved.itemId,
      part_number: resolved.partNumber || null,
      description: resolved.description || null,
      quantity,
      reference: clean(input.reference) || null,
      notes: clean(input.notes) || null,
      performed_by: performedBy,
      entity_type: 'inventory_transaction',
      entity_id: String(transactionId),
      title: `${resolved.isSupply ? 'Supply receipt' : 'Receipt'} posted for ${
        resolved.partNumber || resolved.itemId
      }`,
      details: {
        is_supply: resolved.isSupply,
      },
      write_inventory_transaction: false,
      write_activity_log: true,
      supabase,
    });

    if (!activity.ok) {
      console.error('Receiving activity logging failed after receipt posted.', {
        transactionId: String(transactionId),
        itemId: resolved.itemId,
        partNumber: resolved.partNumber,
        message: 'message' in activity ? activity.message : 'Failed to write activity log.',
      });
    }

    return {
      ok: true,
      message: 'Receipt posted successfully.',
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
    await requireReceivingAccess();

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
    await requireReceivingAccess();

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
        description: row.record.target_description || row.record.description,
        quantity: Number(row.record.quantity) || 0,
        reference: row.record.reference,
        notes: row.record.notes,
        performed_by: row.record.performed_by,
        is_supply: false,
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
