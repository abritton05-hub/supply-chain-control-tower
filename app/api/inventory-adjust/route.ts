import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { itemId, adjustType, quantity, reason, notes } = body;

    if (!itemId || !adjustType || !quantity || !reason) {
      return NextResponse.json({
        ok: false,
        message: 'Missing required fields.',
      });
    }

    const supabase = await supabaseServer();

    // get current qty
    const { data: item, error: itemError } = await supabase
      .from('inventory')
      .select('qty_on_hand')
      .eq('id', itemId)
      .single();

    if (itemError || !item) {
      return NextResponse.json({
        ok: false,
        message: 'Item not found.',
      });
    }

    let newQty = item.qty_on_hand;

    if (adjustType === 'add') {
      newQty += quantity;
    }

    if (adjustType === 'remove') {
      newQty -= quantity;
      if (newQty < 0) newQty = 0;
    }

    if (adjustType === 'set') {
      newQty = quantity;
    }

    // update inventory
    const { error: updateError } = await supabase
      .from('inventory')
      .update({ qty_on_hand: newQty })
      .eq('id', itemId);

    if (updateError) {
      return NextResponse.json({
        ok: false,
        message: updateError.message,
      });
    }

    // log transaction
    await supabase.from('inventory_transactions').insert({
      inventory_id: itemId,
      type: 'ADJUST',
      quantity,
      reason,
      notes,
      created_at: new Date().toISOString(),
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({
      ok: false,
      message: 'Server error.',
    });
  }
}