'use server';

import { revalidatePath } from 'next/cache';
import { getCurrentUserProfile } from '@/lib/auth/profile';
import { canReceiveInventory } from '@/lib/auth/roles';
import { supabaseAdmin } from '@/lib/supabase/admin';
import type { ImportActionResult } from '@/lib/import-workflow/types';
import {
  buildInventoryPreview,
  cleanInventoryText,
  isBlankInventoryRow,
  toInventoryPayload,
  validateInventoryUsability,
} from './inventory-import';
import type { InventoryActionResult, InventoryFormInput, InventoryImportInput } from './types';

type ExistingInventoryMatch = {
  id: string;
  item_id: string;
  part_number: string | null;
  description: string | null;
  category: string | null;
  location: string | null;
  qty_on_hand: number | null;
  reorder_point: number | null;
  is_supply: boolean | null;
};

type SupabaseActionError = {
  message: string;
  code?: string;
  details?: string;
  hint?: string;
};

function databaseErrorMessage(context: string, error: SupabaseActionError) {
  const rawMessage = [error.message, error.details, error.hint].filter(Boolean).join(' ');

  if (error.code === '42P01' || rawMessage.includes('relation') || rawMessage.includes('does not exist')) {
    return `${context}: Supabase inventory tables are missing. Apply docs/supabase-inventory.sql, then reload. Database said: ${rawMessage}`;
  }

  if (error.code === '42703' || rawMessage.includes('column')) {
    return `${context}: Supabase inventory schema is missing an expected column. Apply docs/supabase-inventory.sql, then retry. Database said: ${rawMessage}`;
  }

  if (error.code === '23505') {
    return `${context}: duplicate item ID or part number. Database said: ${rawMessage}`;
  }

  if (error.code === '23514') {
    return `${context}: quantity or reorder point violates an inventory constraint. Database said: ${rawMessage}`;
  }

  return `${context}: ${rawMessage}`;
}

async function requireInventoryWriteAccess() {
  const profile = await getCurrentUserProfile();

  if (!canReceiveInventory(profile.role)) {
    throw new Error('You do not have permission to modify inventory.');
  }
}

function normalizeManualInput(input: InventoryFormInput): InventoryImportInput {
  return {
    ...input,
    item_id: input.item_id ?? '',
    part_number: input.part_number ?? '',
    description: input.description ?? '',
    category: input.category ?? '',
    location: input.location ?? '',
    qty_on_hand: input.qty_on_hand ?? null,
    reorder_point: input.reorder_point ?? null,
    is_supply: input.is_supply ?? false,
    invalid_reasons: [],
  };
}

function validateManualInventory(input: InventoryImportInput): InventoryActionResult {
  if (isBlankInventoryRow(input)) {
    return { ok: false, message: 'Inventory item is blank.' };
  }

  const invalidReason = validateInventoryUsability(input);
  if (invalidReason) {
    return { ok: false, message: invalidReason };
  }

  return { ok: true, message: 'Valid inventory item.' };
}

function revalidateInventoryPaths(itemIds: Iterable<string>) {
  revalidatePath('/receiving');
  revalidatePath('/inventory');
  revalidatePath('/transactions');

  for (const itemId of itemIds) {
    const cleanItemId = cleanInventoryText(itemId);
    if (cleanItemId) {
      revalidatePath(`/inventory/${cleanItemId}`);
    }
  }
}

function buildInventoryPayloadWithSupply(input: InventoryImportInput) {
  return {
    ...toInventoryPayload(input),
    is_supply: input.is_supply ?? false,
  };
}

function toInventoryUpdatePayload(
  input: InventoryImportInput,
  existing: ExistingInventoryMatch
): ReturnType<typeof buildInventoryPayloadWithSupply> {
  const proposed = buildInventoryPayloadWithSupply(input);

  return {
    item_id: cleanInventoryText(input.item_id) || existing.item_id || proposed.item_id,
    part_number:
      cleanInventoryText(input.part_number) || existing.part_number || proposed.part_number,
    description:
      cleanInventoryText(input.description) || existing.description || proposed.description,
    category: cleanInventoryText(input.category) || existing.category || proposed.category,
    location: cleanInventoryText(input.location) || existing.location || proposed.location,
    qty_on_hand:
      input.qty_on_hand === null || input.qty_on_hand === undefined
        ? existing.qty_on_hand ?? proposed.qty_on_hand
        : proposed.qty_on_hand,
    reorder_point:
      input.reorder_point === null || input.reorder_point === undefined
        ? existing.reorder_point ?? proposed.reorder_point
        : proposed.reorder_point,
    is_supply: input.is_supply ?? existing.is_supply ?? false,
  };
}

async function getExistingInventoryMaps(rows: InventoryImportInput[]) {
  const itemIds = Array.from(
    new Set(
      rows
        .filter((row) => !isBlankInventoryRow(row) && !validateInventoryUsability(row))
        .map((row) => cleanInventoryText(row.item_id))
        .filter(Boolean)
    )
  );

  const partNumbers = Array.from(
    new Set(
      rows
        .filter((row) => !isBlankInventoryRow(row) && !validateInventoryUsability(row))
        .map((row) => cleanInventoryText(row.part_number))
        .filter(Boolean)
    )
  );

  const byItemId = new Map<string, ExistingInventoryMatch>();
  const byPartNumber = new Map<string, ExistingInventoryMatch>();

  const supabase = await supabaseAdmin();

  if (itemIds.length > 0) {
    const { data, error } = await supabase
      .from('inventory')
      .select('id,item_id,part_number,description,category,location,qty_on_hand,reorder_point,is_supply')
      .in('item_id', itemIds);

    if (error) {
      throw new Error(databaseErrorMessage('Loading existing inventory by item ID', error));
    }

    (data ?? []).forEach((row) => {
      const record = row as ExistingInventoryMatch;
      if (record.item_id) {
        byItemId.set(record.item_id, record);
      }
      if (record.part_number && !byPartNumber.has(record.part_number)) {
        byPartNumber.set(record.part_number, record);
      }
    });
  }

  if (partNumbers.length > 0) {
    const { data, error } = await supabase
      .from('inventory')
      .select('id,item_id,part_number,description,category,location,qty_on_hand,reorder_point,is_supply')
      .in('part_number', partNumbers);

    if (error) {
      throw new Error(databaseErrorMessage('Loading existing inventory by part number', error));
    }

    (data ?? []).forEach((row) => {
      const record = row as ExistingInventoryMatch;
      if (record.item_id && !byItemId.has(record.item_id)) {
        byItemId.set(record.item_id, record);
      }
      if (record.part_number && !byPartNumber.has(record.part_number)) {
        byPartNumber.set(record.part_number, record);
      }
    });
  }

  return { byItemId, byPartNumber };
}

function findExistingMatch(
  row: InventoryImportInput,
  maps: Awaited<ReturnType<typeof getExistingInventoryMaps>>
) {
  const itemId = cleanInventoryText(row.item_id);
  const partNumber = cleanInventoryText(row.part_number);

  if (itemId && maps.byItemId.has(itemId)) {
    return maps.byItemId.get(itemId);
  }

  if (partNumber && maps.byPartNumber.has(partNumber)) {
    return maps.byPartNumber.get(partNumber);
  }

  return undefined;
}

export async function createInventoryItem(
  input: InventoryFormInput
): Promise<InventoryActionResult> {
  try {
    await requireInventoryWriteAccess();

    const normalized = normalizeManualInput(input);
    const validation = validateManualInventory(normalized);

    if (!validation.ok) {
      return validation;
    }

    const supabase = await supabaseAdmin();
    const itemId = cleanInventoryText(normalized.item_id);
    const partNumber = cleanInventoryText(normalized.part_number);

    if (itemId) {
      const { data: existingByItemId, error: existingByItemIdError } = await supabase
        .from('inventory')
        .select('id')
        .eq('item_id', itemId)
        .limit(1)
        .maybeSingle();

      if (existingByItemIdError) {
        return {
          ok: false,
          message: databaseErrorMessage('Checking item ID uniqueness', existingByItemIdError),
        };
      }

      if (existingByItemId) {
        return { ok: false, message: 'That Item ID already exists.' };
      }
    }

    if (partNumber) {
      const { data: existingByPartNumber, error: existingByPartNumberError } = await supabase
        .from('inventory')
        .select('id')
        .eq('part_number', partNumber)
        .limit(1)
        .maybeSingle();

      if (existingByPartNumberError) {
        return {
          ok: false,
          message: databaseErrorMessage(
            'Checking part number uniqueness',
            existingByPartNumberError
          ),
        };
      }

      if (existingByPartNumber) {
        return { ok: false, message: 'That Part Number already exists.' };
      }
    }

    const { data: insertedRecord, error } = await supabase
      .from('inventory')
      .insert(buildInventoryPayloadWithSupply(normalized))
      .select('item_id')
      .maybeSingle();

    if (error) {
      return { ok: false, message: databaseErrorMessage('Adding inventory item', error) };
    }

    revalidateInventoryPaths([insertedRecord?.item_id ?? itemId]);

    return { ok: true, message: 'Inventory item added.' };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : 'Failed to add inventory item.',
    };
  }
}

export async function updateInventoryItem(
  input: InventoryFormInput
): Promise<InventoryActionResult> {
  try {
    await requireInventoryWriteAccess();

    if (!input.id) {
      return { ok: false, message: 'Inventory record ID is required for edits.' };
    }

    const normalized = normalizeManualInput(input);
    const validation = validateManualInventory(normalized);

    if (!validation.ok) {
      return validation;
    }

    const supabase = await supabaseAdmin();
    const itemId = cleanInventoryText(normalized.item_id);
    const partNumber = cleanInventoryText(normalized.part_number);

    const { data: currentRecord, error: currentRecordError } = await supabase
      .from('inventory')
      .select('id,item_id,part_number,description,category,location,qty_on_hand,reorder_point,is_supply')
      .eq('id', input.id)
      .maybeSingle();

    if (currentRecordError) {
      return {
        ok: false,
        message: databaseErrorMessage('Loading current inventory record', currentRecordError),
      };
    }

    if (!currentRecord) {
      return { ok: false, message: 'Inventory record was not found. Refresh and try again.' };
    }

    if (itemId) {
      const { data: existingByItemId, error: existingByItemIdError } = await supabase
        .from('inventory')
        .select('id')
        .eq('item_id', itemId)
        .neq('id', input.id)
        .limit(1)
        .maybeSingle();

      if (existingByItemIdError) {
        return {
          ok: false,
          message: databaseErrorMessage('Checking item ID uniqueness', existingByItemIdError),
        };
      }

      if (existingByItemId) {
        return { ok: false, message: 'Another inventory record already uses that Item ID.' };
      }
    }

    if (partNumber) {
      const { data: existingByPartNumber, error: existingByPartNumberError } = await supabase
        .from('inventory')
        .select('id')
        .eq('part_number', partNumber)
        .neq('id', input.id)
        .limit(1)
        .maybeSingle();

      if (existingByPartNumberError) {
        return {
          ok: false,
          message: databaseErrorMessage(
            'Checking part number uniqueness',
            existingByPartNumberError
          ),
        };
      }

      if (existingByPartNumber) {
        return { ok: false, message: 'Another inventory record already uses that Part Number.' };
      }
    }

    const { data: updatedRecord, error } = await supabase
      .from('inventory')
      .update(buildInventoryPayloadWithSupply(normalized))
      .eq('id', input.id)
      .select('id,item_id')
      .maybeSingle();

    if (error) {
      return { ok: false, message: databaseErrorMessage('Updating inventory item', error) };
    }

    if (!updatedRecord) {
      return { ok: false, message: 'Inventory record was not updated. Refresh and try again.' };
    }

    revalidateInventoryPaths([currentRecord.item_id, updatedRecord.item_id]);

    return { ok: true, message: 'Inventory item updated.' };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : 'Failed to update inventory item.',
    };
  }
}

export async function importInventoryItems(
  inputs: InventoryImportInput[]
): Promise<InventoryActionResult> {
  try {
    await requireInventoryWriteAccess();

    if (inputs.length === 0) {
      return { ok: false, message: 'No inventory rows were found in the upload.' };
    }

    if (inputs.length > 500) {
      return { ok: false, message: 'Import is limited to 500 rows at a time.' };
    }

    const maps = await getExistingInventoryMaps(inputs);
    const preview = buildInventoryPreview({
      rows: inputs,
      existingItemIds: new Set(maps.byItemId.keys()),
      existingPartNumbers: new Set(maps.byPartNumber.keys()),
    });

    const rowsToSave = preview.rows
      .filter((row) => row.status !== 'skipped')
      .map((row) => row.record);

    if (rowsToSave.length === 0) {
      return {
        ok: false,
        message: `No usable inventory rows to import. Skipped ${preview.summary.skippedBlank} blank and ${preview.summary.skippedInvalid} invalid.`,
        skipReasons: preview.skipReasons
          .map((reason) => `Row ${reason.rowNumber}: ${reason.reason}`)
          .slice(0, 5),
      };
    }

    const supabase = await supabaseAdmin();
    const saveErrors: string[] = [];
    const affectedItemIds = new Set<string>();
    let saved = 0;

    for (const row of rowsToSave) {
      const rowNumber = row.source_row_number ?? saved + 2;
      const existing = findExistingMatch(row, maps);
      const payload = existing ? toInventoryUpdatePayload(row, existing) : buildInventoryPayloadWithSupply(row);

      if (existing) {
        const { error } = await supabase.from('inventory').update(payload).eq('id', existing.id);

        if (error) {
          saveErrors.push(`Row ${rowNumber}: ${databaseErrorMessage('Updating inventory row', error)}`);
        } else {
          saved += 1;
          affectedItemIds.add(existing.item_id);
          affectedItemIds.add(payload.item_id);

          const updatedMatch: ExistingInventoryMatch = {
            id: existing.id,
            item_id: payload.item_id,
            part_number: payload.part_number,
            description: payload.description,
            category: payload.category,
            location: payload.location,
            qty_on_hand: payload.qty_on_hand,
            reorder_point: payload.reorder_point,
            is_supply: payload.is_supply,
          };

          if (existing.item_id !== updatedMatch.item_id) {
            maps.byItemId.delete(existing.item_id);
          }
          if (existing.part_number && existing.part_number !== updatedMatch.part_number) {
            maps.byPartNumber.delete(existing.part_number);
          }
          maps.byItemId.set(updatedMatch.item_id, updatedMatch);
          if (updatedMatch.part_number) {
            maps.byPartNumber.set(updatedMatch.part_number, updatedMatch);
          }
        }
      } else {
        const { data, error } = await supabase
          .from('inventory')
          .insert(payload)
          .select('id,item_id,part_number,description,category,location,qty_on_hand,reorder_point,is_supply')
          .single();

        if (error) {
          saveErrors.push(`Row ${rowNumber}: ${databaseErrorMessage('Adding inventory row', error)}`);
        } else {
          saved += 1;

          const inserted = data as ExistingInventoryMatch;
          affectedItemIds.add(inserted.item_id);
          if (inserted.item_id) {
            maps.byItemId.set(inserted.item_id, inserted);
          }
          if (inserted.part_number) {
            maps.byPartNumber.set(inserted.part_number, inserted);
          }
        }
      }
    }

    revalidateInventoryPaths(affectedItemIds);

    return {
      ok: saved > 0,
      message:
        saveErrors.length > 0
          ? `Inventory import saved ${saved} row(s); ${saveErrors.length} row(s) could not be saved.`
          : `Inventory import complete. ${preview.summary.newRecords} new, ${preview.summary.updates} updated, ${preview.summary.incompleteUsable} incomplete but usable, ${preview.summary.skippedBlank + preview.summary.skippedInvalid} skipped.`,
      skipReasons: [
        ...preview.skipReasons.map((reason) => `Row ${reason.rowNumber}: ${reason.reason}`),
        ...saveErrors,
      ].slice(0, 5),
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : 'Failed to import inventory items.',
    };
  }
}

export async function previewInventoryImport(
  rows: InventoryImportInput[]
): Promise<ImportActionResult<InventoryImportInput>> {
  try {
    await requireInventoryWriteAccess();

    if (rows.length === 0) {
      return { ok: false, message: 'No inventory rows were found.' };
    }

    if (rows.length > 500) {
      return { ok: false, message: 'Import is limited to 500 rows at a time.' };
    }

    const maps = await getExistingInventoryMaps(rows);
    const preview = buildInventoryPreview({
      rows,
      existingItemIds: new Set(maps.byItemId.keys()),
      existingPartNumbers: new Set(maps.byPartNumber.keys()),
    });

    const saveableRows = preview.rows.filter((row) => row.status !== 'skipped').length;

    if (saveableRows === 0) {
      return {
        ok: false,
        message: `No usable inventory rows found. Skipped ${preview.summary.skippedBlank} blank and ${preview.summary.skippedInvalid} invalid.`,
        preview,
        summary: preview.summary,
      };
    }

    return {
      ok: true,
      message: `Ready to review ${saveableRows} inventory row(s).`,
      preview,
      summary: preview.summary,
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : 'Failed to preview inventory rows.',
    };
  }
}