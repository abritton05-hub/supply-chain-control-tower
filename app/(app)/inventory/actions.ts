'use server';

import { revalidatePath } from 'next/cache';
import { supabaseServer } from '@/lib/supabase/server';
import type { InventoryActionResult, InventoryFormInput } from './types';

function clean(value: string | null | undefined) {
  return value?.trim() ?? '';
}

function normalizeQuantity(value: number) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function validateInventory(input: InventoryFormInput): InventoryActionResult {
  if (!clean(input.item_id)) {
    return { ok: false, message: 'Item ID is required.' };
  }

  if (!clean(input.part_number)) {
    return { ok: false, message: 'Part number is required.' };
  }

  if (!clean(input.description)) {
    return { ok: false, message: 'Description is required.' };
  }

  if (!clean(input.category)) {
    return { ok: false, message: 'Category is required.' };
  }

  if (!clean(input.location)) {
    return { ok: false, message: 'Location is required.' };
  }

  if (normalizeQuantity(input.qty_on_hand) < 0) {
    return { ok: false, message: 'Qty on hand cannot be negative.' };
  }

  if (normalizeQuantity(input.reorder_point) < 0) {
    return { ok: false, message: 'Reorder point cannot be negative.' };
  }

  return { ok: true, message: 'Valid inventory item.' };
}

function toPayload(input: InventoryFormInput) {
  return {
    item_id: clean(input.item_id),
    part_number: clean(input.part_number),
    description: clean(input.description),
    category: clean(input.category),
    location: clean(input.location),
    qty_on_hand: normalizeQuantity(input.qty_on_hand),
    reorder_point: normalizeQuantity(input.reorder_point),
  };
}

export async function createInventoryItem(
  input: InventoryFormInput
): Promise<InventoryActionResult> {
  try {
    const validation = validateInventory(input);
    if (!validation.ok) return validation;

    const supabase = await supabaseServer();

    const { data: existing, error: existingError } = await supabase
      .from('inventory')
      .select('id')
      .eq('item_id', clean(input.item_id))
      .maybeSingle();

    if (existingError) {
      return { ok: false, message: existingError.message };
    }

    if (existing) {
      return { ok: false, message: 'That Item ID already exists.' };
    }

    const { error } = await supabase.from('inventory').insert(toPayload(input));

    if (error) {
      return { ok: false, message: error.message };
    }

    revalidatePath('/inventory');
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
    if (!input.id) {
      return { ok: false, message: 'Inventory record ID is required for edits.' };
    }

    const validation = validateInventory(input);
    if (!validation.ok) return validation;

    const supabase = await supabaseServer();
    const { error } = await supabase
      .from('inventory')
      .update(toPayload(input))
      .eq('id', input.id);

    if (error) {
      return { ok: false, message: error.message };
    }

    revalidatePath('/inventory');
    revalidatePath(`/inventory/${clean(input.item_id)}`);
    return { ok: true, message: 'Inventory item updated.' };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : 'Failed to update inventory item.',
    };
  }
}

export async function importInventoryItems(
  inputs: InventoryFormInput[]
): Promise<InventoryActionResult> {
  try {
    if (inputs.length === 0) {
      return { ok: false, message: 'No inventory rows were found in the upload.' };
    }

    if (inputs.length > 500) {
      return { ok: false, message: 'Import is limited to 500 rows at a time.' };
    }

    for (const [index, input] of inputs.entries()) {
      const validation = validateInventory(input);
      if (!validation.ok) {
        return { ok: false, message: `Row ${index + 2}: ${validation.message}` };
      }
    }

    const supabase = await supabaseServer();
    const { error } = await supabase
      .from('inventory')
      .upsert(inputs.map(toPayload), { onConflict: 'item_id' });

    if (error) {
      return { ok: false, message: error.message };
    }

    revalidatePath('/inventory');
    return { ok: true, message: `${inputs.length} inventory row(s) imported.` };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : 'Failed to import inventory items.',
    };
  }
}
