import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getCurrentUserProfile } from '@/lib/auth/profile';
import { canManageUsers } from '@/lib/auth/roles';

export const runtime = 'nodejs';

function clean(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL.');
  if (!serviceKey) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY.');

  return createClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

function normalizeRole(value: unknown) {
  const role = clean(value).toLowerCase();

  if (role === 'admin') return 'admin';
  if (role === 'warehouse') return 'warehouse';

  return 'tech';
}

function getRedirectUrl(request: Request) {
  const siteUrl =
    clean(process.env.NEXT_PUBLIC_SITE_URL) ||
    request.headers.get('origin') ||
    'http://localhost:3000';

  return `${siteUrl}/auth/callback?next=${encodeURIComponent('/update-password')}`;
}

async function requireUserManagementAccess() {
  const profile = await getCurrentUserProfile();

  if (!canManageUsers(profile.role)) {
    return NextResponse.json(
      { ok: false, message: 'Admin access is required to manage users.' },
      { status: 403 }
    );
  }

  return null;
}

export async function GET() {
  try {
    const forbidden = await requireUserManagementAccess();
    if (forbidden) return forbidden;

    const supabase = getAdminClient();

    const { data, error } = await supabase
      .from('profiles')
      .select('id,email,full_name,role,is_active,created_at,updated_at')
      .order('email', { ascending: true });

    if (error) {
      return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      users: data ?? [],
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : 'Failed to load users.',
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const forbidden = await requireUserManagementAccess();
    if (forbidden) return forbidden;

    const body = await request.json();

    const email = clean(body.email).toLowerCase();
    const fullName = clean(body.full_name);
    const role = normalizeRole(body.role);

    if (!email) {
      return NextResponse.json({ ok: false, message: 'Email is required.' }, { status: 400 });
    }

    if (!email.includes('@')) {
      return NextResponse.json({ ok: false, message: 'Enter a valid email.' }, { status: 400 });
    }

    const supabase = getAdminClient();

    const { data: inviteData, error: inviteError } =
      await supabase.auth.admin.inviteUserByEmail(email, {
        redirectTo: getRedirectUrl(request),
        data: {
          full_name: fullName,
          role,
        },
      });

    if (inviteError) {
      return NextResponse.json({ ok: false, message: inviteError.message }, { status: 500 });
    }

    const userId = inviteData.user?.id;

    if (!userId) {
      return NextResponse.json(
        { ok: false, message: 'Invite was sent, but Supabase did not return a user id.' },
        { status: 500 }
      );
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .upsert(
        {
          id: userId,
          email,
          full_name: fullName || null,
          role,
          is_active: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' }
      )
      .select('id,email,full_name,role,is_active,created_at,updated_at')
      .single();

    if (profileError) {
      return NextResponse.json({ ok: false, message: profileError.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      message: `Invite link sent to ${email}.`,
      user: profile,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : 'Failed to invite user.',
      },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const forbidden = await requireUserManagementAccess();
    if (forbidden) return forbidden;

    const body = await request.json();

    const id = clean(body.id);
    const fullName = clean(body.full_name);
    const role = normalizeRole(body.role);

    if (!id) {
      return NextResponse.json({ ok: false, message: 'User id is required.' }, { status: 400 });
    }

    const supabase = getAdminClient();

    const { data, error } = await supabase
      .from('profiles')
      .update({
        full_name: fullName || null,
        role,
        is_active: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select('id,email,full_name,role,is_active,created_at,updated_at')
      .single();

    if (error) {
      return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      message: 'User updated.',
      user: data,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : 'Failed to update user.',
      },
      { status: 500 }
    );
  }
}
