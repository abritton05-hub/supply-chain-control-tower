'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function ProfileMenu() {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  async function handleLogout() {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {}
    router.push('/login');
    router.refresh();
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-300 bg-white text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
      >
        AB
      </button>

      {open ? (
        <div className="absolute right-0 z-50 mt-2 w-44 rounded-xl border border-slate-300 bg-white p-2 shadow-lg">
          <button
            type="button"
            className="block w-full rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100"
          >
            Profile
          </button>
          <button
            type="button"
            onClick={handleLogout}
            className="block w-full rounded-lg px-3 py-2 text-left text-sm text-rose-700 hover:bg-rose-50"
          >
            Logout
          </button>
        </div>
      ) : null}
    </div>
  );
}