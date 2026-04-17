'use server';

import { revalidatePath } from 'next/cache';
import { supabaseServer } from '@/lib/supabase/server';
import type { AddInventoryInput } from '@/lib/types/inventory';

type ActionResult =
  | { ok: true; itemPk: string }
  | { ok: false; message: string };

export async function addInventoryItem(input: AddInventoryInput): Promise<ActionResult> {
  try {
    const supabase = await supabaseServer();

    if (!input.organizationId) {
      return { ok: false, message: 'Organization is required.' };
    }

    if (!input.itemId.trim()) {
      return { ok: false, message: 'Item ID is required.' };
    }

    if (!input.itemName.trim()) {
      return { ok: false, message: 'Item Name is required.' };
    }

    if (!input.description.trim()) {
      return { ok: false, message: 'Description is required.' };
    }

    if (!input.locationId) {
      return { ok: false, message: 'Location is required.' };
    }

    const { data: existingItem, error: existingError } = await supabase
      .from('items')
      .select('id')
      .eq('organization_id', input.organizationId)
      .eq('item_id', input.itemId.trim())
      .maybeSingle();

    if (existingError) {
      return { ok: false, message: existingError.message };
    }

    if (existingItem) {
      return { ok: false, message: 'That Item ID already exists.' };
    }

    const { data: insertedItem, error: itemError } = await supabase
      .from('items')
      .insert({
        organization_id: input.organizationId,
        item_id: input.itemId.trim(),
        item_name: input.itemName.trim(),
        description: input.description.trim(),
        tracking_type: input.trackingType,
        inventory_type: input.inventoryType.trim() || 'COMPONENT',
        criticality: input.criticality,
        preferred_vendor_id: input.preferredVendorId,
        department_id: input.departmentId,
        average_daily_usage: input.averageDailyUsage,
        lead_time_days: input.leadTimeDays,
        safety_stock: input.safetyStock,
      })
      .select('id, item_id')
      .single();

    if (itemError || !insertedItem) {
      return { ok: false, message: itemError?.message || 'Failed to create item.' };
    }

    const itemPk = insertedItem.id;

    const { error: balanceError } = await supabase
      .from('inventory_balances')
      .insert({
        organization_id: input.organizationId,
        item_pk: itemPk,
        location_id: input.locationId,
        quantity_on_hand: input.openingQuantity,
        quantity_allocated: 0,
      });

    if (balanceError) {
      return { ok: false, message: balanceError.message };
    }

    const { error: txError } = await supabase
      .from('inventory_transactions')
      .insert({
        organization_id: input.organizationId,
        item_pk: itemPk,
        location_id: input.locationId,
        transaction_type: 'RECEIPT',
        quantity: input.openingQuantity,
        reference_type: 'OPENING_BALANCE',
        reference_id: insertedItem.item_id,
        notes: input.notes?.trim() || 'Opening inventory balance created with new item.',
        performed_by_user_id: input.performedByUserId ?? null,
      });

    if (txError) {
      return { ok: false, message: txError.message };
    }

    const { error: auditError } = await supabase
      .from('audit_logs')
      .insert({
        organization_id: input.organizationId,
        entity_type: 'ITEM',
        entity_id: itemPk,
        action: 'CREATE',
        old_values_json: null,
        new_values_json: {
          item_id: input.itemId.trim(),
          item_name: input.itemName.trim(),
          opening_quantity: input.openingQuantity,
          location_id: input.locationId,
        },
        performed_by_user_id: input.performedByUserId ?? null,
      });

    if (auditError) {
      return { ok: false, message: auditError.message };
    }

    revalidatePath('/inventory');
    return { ok: true, itemPk };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { ok: false, message };
  }
}