import { NextResponse } from 'next/server';
import { getCurrentUserProfile } from '@/lib/auth/profile';
import { canEditInventory } from '@/lib/auth/roles';
import { supabaseServer } from '@/lib/supabase/server';
import { logTransaction } from '@/lib/transactions/log-transaction';

export async function POST(req: Request) {
  try {
    const profile = await getCurrentUserProfile();

    if (!canEditInventory(profile.role)) {
      return NextResponse.json(
        {
          ok: false,
          message: 'You do not have permission to adjust inventory.',
        },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { itemId, adjustType, reason, notes } = body;
    const quantity = Number(body.quantity);

    if (!itemId || !adjustType || !reason || !Number.isFinite(quantity) || quantity <= 0) {
      return NextResponse.json(
        {
          ok: false,
          message: 'Item, adjustment type, positive quantity, and reason are required.',
        },
        { status: 400 }
      );
    }

    if (!['add', 'remove', 'set'].includes(adjustType)) {
      return NextResponse.json(
        {
          ok: false,
          message: 'Unsupported adjustment type.',
        },
        { status: 400 }
      );
    }

    const supabase = await supabaseServer();

    // get current qty
    const { data: item, error: itemError } = await supabase
      .from('inventory')
      .select('item_id,part_number,description,qty_on_hand,location,site,bin_location,is_active')
      .eq('id', itemId)
      .eq('is_active', true)
      .single();

    if (itemError || !item) {
      return NextResponse.json({
        ok: false,
        message: 'Item not found.',
      });
    }

    const currentQty = Number(item.qty_on_hand) || 0;
    let newQty = currentQty;

    if (adjustType === 'add') {
      newQty += quantity;
    }

    if (adjustType === 'remove') {
      newQty -= quantity;
    }

    if (adjustType === 'set') {
      newQty = quantity;
    }

    if (newQty < 0) {
      return NextResponse.json(
        {
          ok: false,
          message: 'Adjustment would make inventory negative. Reduce the quantity or use a documented adjustment workflow.',
        },
        { status: 400 }
      );
    }

    // update inventory
    const { error: updateError } = await supabase
      .from('inventory')
      .update({ qty_on_hand: newQty })
      .eq('id', itemId)
      .eq('is_active', true);

    if (updateError) {
      return NextResponse.json({
        ok: false,
        message: updateError.message,
      });
    }

    const logResult = await logTransaction({
      transaction_type: 'INVENTORY_ADJUSTMENT',
      item_id: item.item_id,
      part_number: item.part_number,
      description: item.description,
      quantity: newQty - currentQty,
      from_location: [item.site || item.location, item.bin_location].filter(Boolean).join(' / ') || null,
      to_location: [item.site || item.location, item.bin_location].filter(Boolean).join(' / ') || null,
      reference: reason,
      notes,
      entity_type: 'inventory',
      entity_id: item.item_id,
      details: {
        adjust_type: adjustType,
        reason,
        previous_quantity: currentQty,
        new_quantity: newQty,
      },
      write_inventory_transaction: true,
      write_activity_log: true,
    });

    if (!logResult.ok) {
      console.error('Inventory adjustment transaction logging failed.', {
        itemId,
        message: 'message' in logResult ? logResult.message : 'Failed to log adjustment.',
      });
    }

    return NextResponse.json({ ok: true, message: 'Inventory adjusted.' });
  } catch (err) {
    return NextResponse.json({
      ok: false,
      message: err instanceof Error ? err.message : 'Server error.',
    }, { status: 500 });
  }
}
