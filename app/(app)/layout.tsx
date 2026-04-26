import { redirect } from 'next/navigation';
import { getCurrentUserProfile } from '@/lib/auth/profile';
import { isAuthenticated } from '@/lib/auth/session';
import { Sidebar } from '@/components/sidebar';
import { TopHeader } from '@/components/top-header';

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const loggedIn = await isAuthenticated();

  if (!loggedIn) {
    redirect('/login');
  }

  const profile = await getCurrentUserProfile();

  if (!profile.is_active) {
    redirect('/login');
  }

  const isAdmin = profile.role === 'admin';

  return (
    <div className="flex min-h-dvh flex-col bg-slate-200 print:block print:bg-white lg:min-h-screen lg:flex-row">
      <Sidebar isAdmin={isAdmin} />
      <main className="min-w-0 flex-1 overflow-x-hidden overflow-y-auto bg-slate-200 print:block print:overflow-visible print:bg-white">
        <div className="mx-auto w-full max-w-[1800px] space-y-4 px-3 py-3 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] print:space-y-0 print:p-0 sm:px-4 lg:px-6 lg:py-6">
          <TopHeader />
          {children}
        </div>
      </main>
    </div>
  );
}
