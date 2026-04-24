import { getCurrentUserEmail } from '@/lib/auth/session';
import { isAdminEmail, type AppRole } from '@/lib/auth/roles';
import { supabaseServer } from '@/lib/supabase/server';

export type CurrentUserProfile = {
  email: string | null;
  full_name: string | null;
  role: AppRole;
  is_active: boolean;
};

function normalizeRole(value: string | null | undefined): AppRole {
  const role = value?.trim().toLowerCase();

  if (role === 'admin') return 'admin';
  if (role === 'warehouse') return 'warehouse';
  return 'tech';
}

export async function getCurrentUserProfile(): Promise<CurrentUserProfile> {
  const email = await getCurrentUserEmail();

  if (!email) {
    return {
      email: null,
      full_name: null,
      role: 'tech',
      is_active: false,
    };
  }

  if (isAdminEmail(email)) {
    return {
      email,
      full_name: 'Anthony Britton',
      role: 'admin',
      is_active: true,
    };
  }

  try {
    const supabase = await supabaseServer();

    const { data, error } = await supabase
      .from('profiles')
      .select('email, full_name, role, is_active')
      .eq('email', email)
      .maybeSingle();

    if (error || !data) {
      return {
        email,
        full_name: null,
        role: 'tech',
        is_active: true,
      };
    }

    return {
      email: data.email ?? email,
      full_name: data.full_name ?? null,
      role: normalizeRole(data.role),
      is_active: data.is_active ?? true,
    };
  } catch {
    return {
      email,
      full_name: null,
      role: 'tech',
      is_active: true,
    };
  }
}

export async function isAdminUser() {
  const profile = await getCurrentUserProfile();
  return profile.role === 'admin';
}