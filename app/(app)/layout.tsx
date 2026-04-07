import { redirect } from 'next/navigation';
import { isAuthenticated } from '@/lib/auth/session';
import { Sidebar } from '@/components/sidebar';

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
        <div className="border-b border-slate-300 bg-white/70 px-6 py-4 backdrop-blur-sm">
          <div className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
            Supply Chain Control Tower
          </div>
        </div>

        <div className="space-y-4 px-6 py-6">
          {children}
        </div>
      </main>
    </div>
  );
}