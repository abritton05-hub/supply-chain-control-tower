import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { LoginClient } from './login-client';

export const dynamic = 'force-dynamic';

export default async function LoginPage() {
  const session = await getSession();

  if (session) {
    redirect('/inventory');
  }

  return <LoginClient />;
}