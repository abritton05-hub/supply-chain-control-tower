import { redirect } from 'next/navigation';
import { isAuthenticated } from '@/lib/auth/session';
import { Sidebar } from '@/components/sidebar';
import { TopHeader } from '@/components/top-header';

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const loggedIn = isAuthenticated();

  if (!loggedIn) {
    redirect('/login');
  }

  return (
    <div className="flex min-h-screen bg-slate-200">
      <Sidebar />
      <main className="min-w-0 flex-1 overflow-x-hidden overflow-y-auto bg-slate-200">
        <div className="space-y-4 px-6 py-6">
          <TopHeader />
          {children}
        </div>
      </main>
    </div>
  );
}