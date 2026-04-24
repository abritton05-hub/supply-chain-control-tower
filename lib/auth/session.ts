import { supabaseServer } from '@/lib/supabase/server';

export async function getSession() {
  const supabase = await supabaseServer();
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error) {
    return null;
  }

  return session;
}

export async function isAuthenticated() {
  const session = await getSession();
  return Boolean(session?.user?.id);
}

export async function getCurrentUser() {
  const session = await getSession();
  return session?.user ?? null;
}

export async function getCurrentUserEmail() {
  const user = await getCurrentUser();
  return user?.email?.toLowerCase() ?? null;
}