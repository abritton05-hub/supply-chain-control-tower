'use client';

import { ProfileMenu } from '@/components/profile-menu';
import { GlobalSearchShell } from '@/components/global-search-shell';

export function TopHeader() {
  return (
    <header className="sticky top-0 z-40 mb-4 flex flex-col gap-4 rounded-2xl border border-slate-300 bg-white px-6 py-4 shadow-sm lg:flex-row lg:items-center lg:justify-between">
      <div className="shrink-0">
        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
          Supply Chain Control Tower
        </div>
        <div className="mt-1 text-sm text-slate-600">
          ERP operations workspace
        </div>
      </div>

      <div className="flex min-w-0 flex-1 items-center gap-4 lg:justify-end">
        <GlobalSearchShell />
        <ProfileMenu />
      </div>
    </header>
  );
}
