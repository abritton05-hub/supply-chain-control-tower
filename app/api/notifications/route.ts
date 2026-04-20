import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = await supabaseServer();

    const { data, error } = await supabase
      .from('notifications')
      .select('id,type,reference_id,message,is_read,created_at')
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) {
      return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
    }

    const unreadCount = (data ?? []).filter((row) => !row.is_read).length;

    return NextResponse.json({
      ok: true,
      unreadCount,
      notifications: data ?? [],
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : 'Failed to load notifications.',
      },
      { status: 500 }
    );
  }
}