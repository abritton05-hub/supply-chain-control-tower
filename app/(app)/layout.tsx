import { redirect } from 'next/navigation';
import { isAuthenticated } from '@/lib/auth/session';
import { Sidebar } from '@/components/sidebar';

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const loggedIn = await isAuthenticated();

  if (!loggedIn) {
    redirect('/login');
  }

  return (
    <div className="flex min-h-screen bg-slate-100">
      <Sidebar />
      <main className="min-w-0 flex-1 px-4 py-4 md:px-6">{children}</main>
    </div>
  );
}