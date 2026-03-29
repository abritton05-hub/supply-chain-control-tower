'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { GlobalSearch } from '@/components/global-search';
import { EditableUser, getCurrentUserRecord, isLoggedIn, logoutUser } from '@/lib/state/mock-users';

export function TopHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<EditableUser | null>(null);

  useEffect(() => {
    if (!isLoggedIn()) {
      setCurrentUser(null);
      return;
    }
    setCurrentUser(getCurrentUserRecord());
  }, [pathname]);

  if (pathname === '/login') return null;

  const handleLogout = () => {
    logoutUser();
    router.push('/login');
  };

  return (
    <header className="mb-4 flex h-14 items-center justify-between border-b border-slate-200 bg-white px-4">
      <div className="text-xs text-slate-500">User-attributed operations enabled</div>
      <div className="flex items-center gap-3">
        <GlobalSearch />
        <button className="rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700">
          {currentUser ? `${currentUser.name} · ${currentUser.role}` : 'Not logged in'} ▾
        </button>
        <button
          onClick={handleLogout}
          className="rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
        >
          Logout
        </button>
      </div>
    </header>
  );
}