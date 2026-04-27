'use server';

import { revalidatePath } from 'next/cache';
import { getCurrentUserProfile } from '@/lib/auth/profile';
import { canDeleteInventory, canEditInventory } from '@/lib/auth/roles';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { logTransaction } from '@/lib/transactions/log-transaction';
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
  site: string | null;
  bin_location: string | null;
  qty_on_hand: number | null;
  reorder_point: number | null;
  is_supply: boolean | null;
  is_active?: boolean | null;
};

type InventoryPayload = {
  item_id: string;
  part_number: string;
  description: string;
  category: string | null;
  location: string;
  site: string;
  bin_location: string | null;
  qty_on_hand: number;
  reorder_point: number;
  is_supply: boolean;
  is_active: boolean;
};

type SupabaseActionError = {
  message: string;
  code?: string;
  details?: string;
  hint?: string;
};

function normalizeSite(value: string | null | undefined) {
  const clean = cleanInventoryText(value).toUpperCase();

  if (clean === 'WH') return 'WH/A13';
  if (clean === 'A13') return 'WH/A13';
  if (clean === 'WH/A13') return 'WH/A13';

  return clean || 'SEA991';
}

function databaseErrorMessage(context: string, error: SupabaseActionError) {
  const rawMessage = [error.message, error.details, error.hint].filter(Boolean).join(' ');

  if (error.code === '42P01' || rawMessage.includes('relation') || rawMessage.includes('does not exist')) {
    return `${context}: Supabase inventory tables are missing. Apply docs/supabase-inventory.sql, then reload. Database said: ${rawMessage}`;
  }

  if (error.code === '42703' || rawMessage.includes('column')) {
    return `${context}: Supabase inventory schema is missing an expected column. Add the missing column, then retry. Database said: ${rawMessage}`;
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

  if (!canEditInventory(profile.role)) {
    throw new Error('You do not have permission to modify inventory.');
  }
}

async function requireInventoryDeleteAccess() {
  const profile = await getCurrentUserProfile();

  if (!canDeleteInventory(profile.role)) {
    throw new Error('Only admins can delete inventory items.');
  }
}

function normalizeManualInput(input: InventoryFormInput): InventoryImportInput {
  const site = normalizeSite(input.site || input.location);

  return {
    ...input,
    item_id: input.item_id ?? '',
    part_number: input.part_number ?? '',
    description: input.description ?? '',
    category: input.category ?? '',
    location: site,
    site,
    bin_location: input.bin_location ?? '',
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

function inventoryPlace(site: string | null | undefined, binLocation: string | null | undefined) {
  return [cleanInventoryText(site), cleanInventoryText(binLocation)].filter(Boolean).join(' / ') || null;
}

type ReferenceCheck = {
  label: string;
  count: number;
};

type ReferenceCheckResult = {
  references: ReferenceCheck[];
  skippedMessages: string[];
};

const REFERENCE_CHECK_TIMEOUT_MS = 1500;

function isMissingOptionalReference(error: SupabaseActionError) {
  const rawMessage = [error.message, error.details, error.hint, error.code]
    .filter(Boolean)
    .join(' ');

  return (
    error.code === '42P01' ||
    error.code === '42703' ||
    error.code === 'PGRST204' ||
    error.code === 'PGRST205' ||
    rawMessage.includes('relation') ||
    rawMessage.includes('does not exist') ||
    rawMessage.includes('column') ||
    rawMessage.includes('schema cache') ||
    rawMessage.includes('Could not find the table')
  );
}

function isAbortedReferenceCheck(error: SupabaseActionError) {
  const rawMessage = [error.message, error.details, error.hint, error.code]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return rawMessage.includes('abort') || rawMessage.includes('timeout');
}

function referenceAbortSignal() {
  if (typeof AbortSignal.timeout === 'function') {
    return AbortSignal.timeout(REFERENCE_CHECK_TIMEOUT_MS);
  }

  const controller = new AbortController();
  setTimeout(() => controller.abort(), REFERENCE_CHECK_TIMEOUT_MS);
  return controller.signal;
}

function referenceSkipMessage(label: string, error: SupabaseActionError) {
  if (isMissingOptionalReference(error)) {
    return `Reference check skipped because ${label} table is not installed.`;
  }

  if (isAbortedReferenceCheck(error)) {
    return `Reference check skipped because ${label} did not respond in time.`;
  }

  return `Reference check skipped because ${label} could not be checked.`;
}

async function countExactReference(input: {
  supabase: Awaited<ReturnType<typeof supabaseAdmin>>;
  table: string;
  label: string;
  column: string;
  value: string | null | undefined;
  optional?: boolean;
}) {
  const value = cleanInventoryText(input.value);

  if (!value) return { count: 0, skippedMessage: null };

  let query = input.supabase
    .from(input.table)
    .select('id')
    .eq(input.column, value)
    .limit(1);

  query = query.abortSignal(referenceAbortSignal());

  const { data, error } = await query;

  if (error) {
    if (input.optional) {
      const skippedMessage = referenceSkipMessage(input.label, error);
      console.warn(`Skipping optional inventory reference check for ${input.table}.${input.column}.`, {
        message: error.message,
      });
      return { count: 0, skippedMessage };
    }

    console.warn(`Skipping inventory reference check for ${input.table}.${input.column}.`, {
      message: error.message,
    });
    return {
      count: 0,
      skippedMessage: referenceSkipMessage(input.label, error),
    };
  }

  return { count: data && data.length > 0 ? 1 : 0, skippedMessage: null };
}

async function countTextReference(input: {
  supabase: Awaited<ReturnType<typeof supabaseAdmin>>;
  table: string;
  label: string;
  column: string;
  value: string | null | undefined;
  optional?: boolean;
}) {
  const value = cleanInventoryText(input.value);

  if (!value) return { count: 0, skippedMessage: null };

  let query = input.supabase
    .from(input.table)
    .select('id')
    .ilike(input.column, `%${value}%`)
    .limit(1);

  query = query.abortSignal(referenceAbortSignal());

  const { data, error } = await query;

  if (error) {
    if (input.optional) {
      const skippedMessage = referenceSkipMessage(input.label, error);
      console.warn(`Skipping optional inventory reference check for ${input.table}.${input.column}.`, {
        message: error.message,
      });
      return { count: 0, skippedMessage };
    }

    console.warn(`Skipping inventory reference check for ${input.table}.${input.column}.`, {
      message: error.message,
    });
    return {
      count: 0,
      skippedMessage: referenceSkipMessage(input.label, error),
    };
  }

  return { count: data && data.length > 0 ? 1 : 0, skippedMessage: null };
}

function summarizeReferenceResults(label: string, results: Awaited<ReturnType<typeof countExactReference>>[]) {
  return {
    label,
    count: results.reduce((total, result) => total + result.count, 0),
    skippedMessages: Array.from(
      new Set(results.map((result) => result.skippedMessage).filter(Boolean) as string[])
    ),
  };
}

async function checkInventoryReferences(
  supabase: Awaited<ReturnType<typeof supabaseAdmin>>,
  item: Pick<ExistingInventoryMatch, 'item_id' | 'part_number'>
): Promise<ReferenceCheckResult> {
  const checks = await Promise.all([
    Promise.all([
      countExactReference({
          supabase,
          table: 'inventory_transactions',
          label: 'transaction history',
          column: 'item_id',
          value: item.item_id,
        }),
      countExactReference({
          supabase,
          table: 'inventory_transactions',
          label: 'transaction history',
          column: 'part_number',
          value: item.part_number,
        }),
    ]).then((results) => summarizeReferenceResults('inventory transaction', results)),
    Promise.all([
      countExactReference({
          supabase,
          table: 'pull_request_lines',
          label: 'pull request lines',
          column: 'item_id',
          value: item.item_id,
        }),
      countExactReference({
          supabase,
          table: 'pull_request_lines',
          label: 'pull request lines',
          column: 'part_number',
          value: item.part_number,
        }),
    ]).then((results) => summarizeReferenceResults('pull request line', results)),
    Promise.all([
      countExactReference({
          supabase,
          table: 'delivery_stop_items',
          label: 'delivery stop items',
          column: 'item_id',
          value: item.item_id,
          optional: true,
        }),
      countExactReference({
          supabase,
          table: 'delivery_stop_items',
          label: 'delivery stop items',
          column: 'part_number',
          value: item.part_number,
          optional: true,
        }),
    ]).then((results) => summarizeReferenceResults('delivery stop item', results)),
    Promise.all([
      countTextReference({
          supabase,
          table: 'shipping_manifest_history',
          label: 'manifest history',
          column: 'items',
          value: item.item_id,
          optional: true,
        }),
      countTextReference({
          supabase,
          table: 'shipping_manifest_history',
          label: 'manifest history',
          column: 'items',
          value: item.part_number,
          optional: true,
        }),
    ]).then((results) => summarizeReferenceResults('manifest history', results)),
    Promise.all([
      countTextReference({
          supabase,
          table: 'shipping_bom_history',
          label: 'BOM history',
          column: 'items',
          value: item.item_id,
          optional: true,
        }),
      countTextReference({
          supabase,
          table: 'shipping_bom_history',
          label: 'BOM history',
          column: 'items',
          value: item.part_number,
          optional: true,
        }),
    ]).then((results) => summarizeReferenceResults('BOM history', results)),
  ]);

  return {
    references: checks
      .filter((check) => check.count > 0)
      .map(({ label, count }) => ({ label, count })),
    skippedMessages: Array.from(new Set(checks.flatMap((check) => check.skippedMessages))),
  };
}

async function logInventoryAudit(
  supabase: Awaited<ReturnType<typeof supabaseAdmin>>,
  input: {
    transaction_type:
      | 'INVENTORY_CREATED'
      | 'INVENTORY_UPDATED'
      | 'INVENTORY_ADJUSTMENT'
      | 'INVENTORY_ARCHIVED';
    item_id: string;
    part_number: string | null;
    description: string | null;
    quantity?: number | null;
    from_location?: string | null;
    to_location?: string | null;
    reference?: string | null;
    notes?: string | null;
    details?: Record<string, unknown>;
  }
) {
  const result = await logTransaction({
    ...input,
    entity_type: 'inventory',
    entity_id: input.item_id,
    title: `${input.transaction_type.replace(/_/g, ' ')} ${input.part_number || input.item_id}`,
    write_inventory_transaction: true,
    write_activity_log: true,
    supabase,
  });

  if (result.ok === false) {
    console.error('Inventory transaction logging failed.', {
      itemId: input.item_id,
      transactionType: input.transaction_type,
      message: result.message,
    });
  }
}

function buildInventoryPayloadWithSupply(input: InventoryImportInput): InventoryPayload {
  const base = toInventoryPayload(input);

  return {
    ...base,
    site: normalizeSite(base.site || base.location),
    location: normalizeSite(base.site || base.location),
    bin_location: cleanInventoryText(base.bin_location) || null,
    is_supply: input.is_supply ?? false,
    is_active: true,
  };
}

function toInventoryUpdatePayload(
  input: InventoryImportInput,
  existing: ExistingInventoryMatch
): InventoryPayload {
  const proposed = buildInventoryPayloadWithSupply(input);

  const site = normalizeSite(input.site || input.location || existing.site || existing.location || proposed.site);
  const binLocation =
    cleanInventoryText(input.bin_location) ||
    cleanInventoryText(existing.bin_location) ||
    cleanInventoryText(proposed.bin_location);

  return {
    item_id: cleanInventoryText(input.item_id) || existing.item_id || proposed.item_id,
    part_number:
      cleanInventoryText(input.part_number) || existing.part_number || proposed.part_number,
    description:
      cleanInventoryText(input.description) || existing.description || proposed.description,
    category: cleanInventoryText(input.category) || existing.category || proposed.category,
    location: site,
    site,
    bin_location: binLocation || null,
    qty_on_hand:
      input.qty_on_hand === null || input.qty_on_hand === undefined
        ? existing.qty_on_hand ?? proposed.qty_on_hand
        : proposed.qty_on_hand,
    reorder_point:
      input.reorder_point === null || input.reorder_point === undefined
        ? existing.reorder_point ?? proposed.reorder_point
        : proposed.reorder_point,
    is_supply: input.is_supply ?? existing.is_supply ?? false,
    is_active: true,
  };
}

async function getExistingInventoryMaps(rows: InventoryImportInput[]) {
  const usableRows = rows.filter((row) => !isBlankInventoryRow(row) && !validateInventoryUsability(row));

  const itemIds = Array.from(
    new Set(
      usableRows
        .map((row) => cleanInventoryText(row.item_id))
        .filter(Boolean)
    )
  );

  const partNumbers = Array.from(
    new Set(
      usableRows
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
      .select('id,item_id,part_number,description,category,location,site,bin_location,qty_on_hand,reorder_point,is_supply,is_active')
      .in('item_id', itemIds)
      .eq('is_active', true);

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
      .select('id,item_id,part_number,description,category,location,site,bin_location,qty_on_hand,reorder_point,is_supply,is_active')
      .in('part_number', partNumbers)
      .eq('is_active', true);

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

    const payload = buildInventoryPayloadWithSupply(normalized);

    const { data: insertedRecord, error } = await supabase
      .from('inventory')
      .insert(payload)
      .select('item_id,part_number,description,site,bin_location,qty_on_hand,is_active')
      .maybeSingle();

    if (error) {
      return { ok: false, message: databaseErrorMessage('Adding inventory item', error) };
    }

    const loggedRecord = insertedRecord ?? payload;
    await logInventoryAudit(supabase, {
      transaction_type: 'INVENTORY_CREATED',
      item_id: loggedRecord.item_id ?? itemId,
      part_number: loggedRecord.part_number ?? payload.part_number,
      description: loggedRecord.description ?? payload.description,
      quantity: loggedRecord.qty_on_hand ?? payload.qty_on_hand,
      to_location: inventoryPlace(loggedRecord.site ?? payload.site, loggedRecord.bin_location ?? payload.bin_location),
      reference: loggedRecord.item_id ?? itemId,
      notes: 'Inventory item created.',
      details: payload,
    });

    revalidateInventoryPaths([loggedRecord.item_id ?? itemId]);

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
      .select('id,item_id,part_number,description,category,location,site,bin_location,qty_on_hand,reorder_point,is_supply,is_active')
      .eq('id', input.id)
      .eq('is_active', true)
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

    const payload = buildInventoryPayloadWithSupply(normalized);

    const { data: updatedRecord, error } = await supabase
      .from('inventory')
      .update(payload)
      .eq('id', input.id)
      .eq('is_active', true)
      .select('id,item_id,part_number,description,site,bin_location,qty_on_hand,is_active')
      .maybeSingle();

    if (error) {
      return { ok: false, message: databaseErrorMessage('Updating inventory item', error) };
    }

    if (!updatedRecord) {
      return { ok: false, message: 'Inventory record was not updated. Refresh and try again.' };
    }

    const current = currentRecord as ExistingInventoryMatch;
    const previousQty = current.qty_on_hand ?? 0;
    const nextQty = updatedRecord.qty_on_hand ?? payload.qty_on_hand ?? 0;
    const quantityChanged = previousQty !== nextQty;

    await logInventoryAudit(supabase, {
      transaction_type: 'INVENTORY_UPDATED',
      item_id: updatedRecord.item_id,
      part_number: updatedRecord.part_number ?? payload.part_number,
      description: updatedRecord.description ?? payload.description,
      quantity: quantityChanged ? nextQty - previousQty : null,
      from_location: inventoryPlace(current.site || current.location, current.bin_location),
      to_location: inventoryPlace(updatedRecord.site ?? payload.site, updatedRecord.bin_location ?? payload.bin_location),
      reference: updatedRecord.item_id,
      notes: quantityChanged
        ? `Inventory quantity changed from ${previousQty} to ${nextQty}.`
        : 'Inventory item updated.',
      details: {
        before: current,
        after: payload,
      },
    });

    revalidateInventoryPaths([current.item_id, updatedRecord.item_id]);

    return { ok: true, message: 'Inventory item updated.' };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : 'Failed to update inventory item.',
    };
  }
}

export async function archiveInventoryItem(itemId: string): Promise<InventoryActionResult> {
  try {
    await requireInventoryDeleteAccess();

    const cleanItemId = cleanInventoryText(itemId);

    if (!cleanItemId) {
      return { ok: false, message: 'Inventory item ID is required.' };
    }

    const supabase = await supabaseAdmin();
    const { data: currentRecord, error: currentRecordError } = await supabase
      .from('inventory')
      .select(
        'id,item_id,part_number,description,category,location,site,bin_location,qty_on_hand,reorder_point,is_supply,is_active'
      )
      .eq('item_id', cleanItemId)
      .maybeSingle();

    if (currentRecordError) {
      return {
        ok: false,
        message: databaseErrorMessage('Loading inventory record for delete', currentRecordError),
      };
    }

    if (!currentRecord) {
      return { ok: false, message: 'Inventory record was not found.' };
    }

    const current = currentRecord as ExistingInventoryMatch;

    if (current.is_active === false) {
      return { ok: false, message: 'Inventory item is already archived.' };
    }

    const referenceCheck = await checkInventoryReferences(supabase, current);
    const { references, skippedMessages } = referenceCheck;
    const archivedAt = new Date().toISOString();
    const { error: archiveError } = await supabase
      .from('inventory')
      .update({ is_active: false, updated_at: archivedAt })
      .eq('id', current.id);

    if (archiveError) {
      return {
        ok: false,
        message: databaseErrorMessage('Archiving inventory item', archiveError),
      };
    }

    const referenceSummary =
      references.length > 0
        ? references.map((reference) => `${reference.count} ${reference.label}(s)`).join(', ')
        : 'No history references found before archive.';
    const transactionReference = references.find(
      (reference) => reference.label === 'inventory transaction'
    );
    const advisoryMessages = [
      transactionReference && transactionReference.count > 0
        ? 'Item cannot be deleted because it has transaction history.'
        : null,
      ...skippedMessages,
    ].filter(Boolean) as string[];

    await logInventoryAudit(supabase, {
      transaction_type: 'INVENTORY_ARCHIVED',
      item_id: current.item_id,
      part_number: current.part_number,
      description: current.description,
      quantity: current.qty_on_hand,
      from_location: inventoryPlace(current.site || current.location, current.bin_location),
      reference: current.item_id,
      notes: `Inventory item archived. ${referenceSummary}`,
      details: {
        archived_at: archivedAt,
        before: current,
        references,
        skipped_reference_checks: skippedMessages,
      },
    });

    revalidateInventoryPaths([current.item_id]);

    return {
      ok: true,
      message: 'Item archived.',
      skipReasons: advisoryMessages.length > 0 ? advisoryMessages : undefined,
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : 'Failed to archive inventory item.',
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
        const { error } = await supabase
          .from('inventory')
          .update(payload)
          .eq('id', existing.id)
          .eq('is_active', true);

        if (error) {
          saveErrors.push(`Row ${rowNumber}: ${databaseErrorMessage('Updating inventory row', error)}`);
        } else {
          saved += 1;
          affectedItemIds.add(existing.item_id);
          affectedItemIds.add(payload.item_id);
          await logInventoryAudit(supabase, {
            transaction_type: 'INVENTORY_UPDATED',
            item_id: payload.item_id,
            part_number: payload.part_number,
            description: payload.description,
            quantity:
              (existing.qty_on_hand ?? 0) !== (payload.qty_on_hand ?? 0)
                ? (payload.qty_on_hand ?? 0) - (existing.qty_on_hand ?? 0)
                : null,
            from_location: inventoryPlace(existing.site || existing.location, existing.bin_location),
            to_location: inventoryPlace(payload.site, payload.bin_location),
            reference: payload.item_id,
            notes: `Inventory import updated row ${rowNumber}.`,
            details: {
              before: existing,
              after: payload,
              source_row_number: rowNumber,
            },
          });

          const updatedMatch: ExistingInventoryMatch = {
            id: existing.id,
            item_id: payload.item_id,
            part_number: payload.part_number,
            description: payload.description,
            category: payload.category,
            location: payload.location,
            site: payload.site,
            bin_location: payload.bin_location,
            qty_on_hand: payload.qty_on_hand,
            reorder_point: payload.reorder_point,
            is_supply: payload.is_supply,
            is_active: true,
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
          .select('id,item_id,part_number,description,category,location,site,bin_location,qty_on_hand,reorder_point,is_supply,is_active')
          .single();

        if (error) {
          saveErrors.push(`Row ${rowNumber}: ${databaseErrorMessage('Adding inventory row', error)}`);
        } else {
          saved += 1;

          const inserted = data as ExistingInventoryMatch;
          affectedItemIds.add(inserted.item_id);
          await logInventoryAudit(supabase, {
            transaction_type: 'INVENTORY_CREATED',
            item_id: inserted.item_id,
            part_number: inserted.part_number,
            description: inserted.description,
            quantity: inserted.qty_on_hand,
            to_location: inventoryPlace(inserted.site || inserted.location, inserted.bin_location),
            reference: inserted.item_id,
            notes: `Inventory import created row ${rowNumber}.`,
            details: {
              after: inserted,
              source_row_number: rowNumber,
            },
          });
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
