import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { request_id, performed_by } = body;

    const supabase = await supabaseServer();

    // 1. Get request lines
    const { data: lines, error: lineError } = await supabase
      .from('pull_request_lines')
      .select('*')
      .eq('request_id', request_id);

    if (lineError) {
      return NextResponse.json({ ok: false, message: lineError.message });
    }

    // 2. Update inventory + create transactions
    for (const line of lines) {
      // Get current inventory
      const { data: item } = await supabase
        .from('inventory')
        .select('qty_on_hand')
        .eq('item_id', line.item_id)
        .single();

      const newQty = (item?.qty_on_hand || 0) - (line.quantity || 0);

      // Update inventory
      await supabase
        .from('inventory')
        .update({ qty_on_hand: newQty })
        .eq('item_id', line.item_id);

      // Insert transaction log
      await supabase.from('transactions').insert({
        type: 'PULL_REQUEST',
        item_id: line.item_id,
        part_number: line.part_number,
        qty: line.quantity,
        from_location: line.location,
        to_location: 'FIELD',
        performed_by,
        request_id,
        created_at: new Date().toISOString(),
      });
    }

    // 3. Mark request completed
    await supabase
      .from('pull_requests')
      .update({
        status: 'COMPLETED',
        fulfilled_by: performed_by,
        fulfilled_at: new Date().toISOString(),
      })
      .eq('id', request_id);

    return NextResponse.json({ ok: true });

  } catch (err: any) {
    return NextResponse.json({ ok: false, message: err.message });
  }
}