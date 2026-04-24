import { NextResponse } from 'next/server';
import { getCurrentUserProfile } from '@/lib/auth/profile';
import { supabaseServer } from '@/lib/supabase/server';

export async function GET() {
  try {
    const profile = await getCurrentUserProfile();

    if (!profile.is_active) {
      return NextResponse.json(
        {
          ok: false,
          message: 'Inactive user.',
        },
        { status: 403 }
      );
    }

    const supabase = await supabaseServer();

    const { count, error } = await supabase
      .from('pull_requests')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'OPEN');

    if (error) {
      return NextResponse.json(
        {
          ok: false,
          message: error.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      notifications: {
        open_pull_requests: count ?? 0,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error ? error.message : 'Failed to load notifications.',
      },
      { status: 500 }
    );
  }
}