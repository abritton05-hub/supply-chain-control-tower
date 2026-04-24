import { NextResponse } from 'next/server';
import { getCurrentUserProfile } from '@/lib/auth/profile';
import { canManageUsers } from '@/lib/auth/roles';
import { supabaseServer } from '@/lib/supabase/server';

function clean(value: string | null | undefined) {
  return value?.trim() || '';
}

export async function GET() {
  try {
    const currentProfile = await getCurrentUserProfile();

    if (!canManageUsers(currentProfile.role)) {
      return NextResponse.json(
        {
          ok: false,
          message: 'Admin access required.',
        },
        { status: 403 }
      );
    }

    const supabase = await supabaseServer();

    const { data, error } = await supabase
      .from('profiles')
      .select('id,email,full_name,role,is_active,created_at,updated_at')
      .order('email', { ascending: true });

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
      users: data ?? [],
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error ? error.message : 'Failed to load users.',
      },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const currentProfile = await getCurrentUserProfile();

    if (!canManageUsers(currentProfile.role)) {
      return NextResponse.json(
        {
          ok: false,
          message: 'Admin access required.',
        },
        { status: 403 }
      );
    }

    const body = (await request.json()) as {
      id?: string;
      full_name?: string;
      role?: string;
      is_active?: boolean;
    };

    const id = clean(body.id);

    if (!id) {
      return NextResponse.json(
        {
          ok: false,
          message: 'User id is required.',
        },
        { status: 400 }
      );
    }

    const allowedRoles = ['tech', 'warehouse', 'admin'];
    const role = clean(body.role).toLowerCase();

    if (role && !allowedRoles.includes(role)) {
      return NextResponse.json(
        {
          ok: false,
          message: 'Invalid role.',
        },
        { status: 400 }
      );
    }

    const updatePayload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (typeof body.full_name === 'string') {
      updatePayload.full_name = clean(body.full_name) || null;
    }

    if (role) {
      updatePayload.role = role;
    }

    if (typeof body.is_active === 'boolean') {
      updatePayload.is_active = body.is_active;
    }

    const supabase = await supabaseServer();

    const { data, error } = await supabase
      .from('profiles')
      .update(updatePayload)
      .eq('id', id)
      .select('id,email,full_name,role,is_active,created_at,updated_at')
      .single();

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
      message: 'User updated successfully.',
      user: data,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error ? error.message : 'Failed to update user.',
      },
      { status: 500 }
    );
  }
}