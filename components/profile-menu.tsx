'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function ProfileMenu() {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  function handleLogout() {
    document.cookie = 'auth-token=; path=/; max-age=0';
    router.push('/login');
  }

  return (
    <div className="relative">
      {/* Profile Circle */}
      <button
        onClick={() => setOpen(!open)}
        className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-700 text-white"
      >
        A
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 mt-2 w-40 rounded-md border bg-white shadow-lg">
          <button
            onClick={() => alert('Profile modal coming next')}
            className="block w-full px-4 py-2 text-left text-sm hover:bg-slate-100"
          >
            Profile
          </button>

          <button
            onClick={handleLogout}
            className="block w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-slate-100"
          >
            Logout
          </button>
        </div>
      )}
    </div>
  );
}