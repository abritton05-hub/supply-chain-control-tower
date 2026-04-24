import { NextResponse } from 'next/server';
import { supabaseRest } from '@/lib/supabase/rest';

export async function POST(req: Request) {
  try {
    const { request_id, performed_by } = await req.json();

    // 1. get request lines
    const lines = await supabaseRest<any[]>('pull_request_lines', {
      params: {
        select: '*',
        pull_request_id: `eq.${request_id}`,
      },
    });

    // 2. subtract inventory + log transaction
    for (const line of lines) {
      // subtract inventory
      await supabaseRest('inventory', {
        method: 'PATCH',
        params: { item_id: `eq.${line.item_id}` },
        body: {
          qty_on_hand: line.quantity * -1, // 🔥 handled via DB trigger or manual calc later
        },
      });

      // log transaction
      await supabaseRest('inventory_transactions', {
        method: 'POST',
        body: {
          item_id: line.item_id,
          part_number: line.part_number,
          description: line.description,
          transaction_type: 'ISSUE',
          quantity: line.quantity,
          reference: `PR-${request_id}`,
          performed_by,
        },
      });
    }

    // 3. mark request complete
    await supabaseRest('pull_requests', {
      method: 'PATCH',
      params: { id: `eq.${request_id}` },
      body: { status: 'COMPLETED' },
    });

    // 4. mark notifications read
    await supabaseRest('notifications', {
      method: 'PATCH',
      params: { reference_id: `eq.${request_id}` },
      body: { is_read: true },
    });

    return NextResponse.json({ ok: true });

  } catch (err: any) {
    return NextResponse.json({ ok: false, message: err.message });
  }
}