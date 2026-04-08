'use client';

import { ProfileMenu } from '@/components/profile-menu';

export function TopHeader() {
  return (
    <header className="mb-4 flex items-center justify-between rounded-2xl border border-slate-300 bg-white px-6 py-4 shadow-sm">
      <div>
        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
          Supply Chain Control Tower
        </div>
        <div className="mt-1 text-sm text-slate-600">
          ERP operations workspace
        </div>
      </div>

      <ProfileMenu />
    </header>
  );
}