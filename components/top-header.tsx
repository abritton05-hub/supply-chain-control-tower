'use client';

import Link from 'next/link';
import { GlobalSearch } from '@/components/global-search';
import { useCurrentAdminUser } from '@/lib/state/mock-client-db';

export function TopHeader() {
  const currentUser = useCurrentAdminUser();

  return (
    <header className="mb-4 flex h-14 items-center justify-between border-b border-slate-200 bg-white px-4">
      <div className="text-xs text-slate-500">User-attributed operations enabled · Mock ERP admin session</div>
      <div className="flex items-center gap-3">
        <GlobalSearch />
        <div className="rounded border border-slate-300 bg-white px-3 py-1 text-left text-xs text-slate-700">
          <div className="font-semibold text-slate-900">{currentUser.name} · {currentUser.role} ▾</div>
          <div className="text-[11px] text-slate-500">{currentUser.email} · {currentUser.department} · {currentUser.active ? 'Active' : 'Disabled'}</div>
        </div>
        <Link href="/users/u1" className="rounded border border-slate-300 bg-white px-2 py-1 text-xs text-cyan-700 hover:underline">
          Admin Profile
        </Link>
      </div>
    </header>
  );
}
