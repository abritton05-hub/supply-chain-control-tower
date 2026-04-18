'use server';

import { revalidatePath } from 'next/cache';
import { supabaseServer } from '@/lib/supabase/server';
import type { ReceiveActionResult, ReceiveInventoryInput } from './types';

function clean(value: string | null | undefined) {
  return value?.trim() ?? '';
}

export async function receiveInventoryItem(
  input: ReceiveInventoryInput
): Promise<ReceiveActionResult> {
  try {
    const itemId = clean(input.item_id);
    const quantity = Number(input.quantity);

    if (!itemId) {
      return { ok: false, message: 'Select an inventory item.' };
    }

    if (!Number.isFinite(quantity) || quantity <= 0) {
      return { ok: false, message: 'Received quantity must be greater than 0.' };
    }

    const supabase = await supabaseServer();

    const { error } = await supabase.rpc('receive_inventory_item', {
      p_item_id: itemId,
      p_quantity: quantity,
      p_reference: clean(input.reference) || null,
      p_notes: clean(input.notes) || null,
      p_performed_by: clean(input.performed_by) || null,
    });

    if (error) {
      return { ok: false, message: error.message };
    }

    revalidatePath('/receiving');
    revalidatePath('/inventory');
    revalidatePath(`/inventory/${itemId}`);
    revalidatePath('/transactions');

    return { ok: true, message: 'Receipt saved. Inventory and transaction history were updated.' };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : 'Failed to save receipt.',
    };
  }
}
