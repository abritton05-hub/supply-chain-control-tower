'use client';

import Link from 'next/link';

export function Sidebar() {
  return (
    <aside className="h-screen w-72 flex-shrink-0 border-r border-slate-800 bg-slate-900 p-4 text-slate-200">
      <h1 className="mb-6 text-sm font-semibold uppercase tracking-widest text-slate-400">
        Supply Chain Control Tower
      </h1>

      <nav className="space-y-2">
        <Link href="/executive-dashboard" className="block rounded px-3 py-2 text-sm text-slate-300 hover:bg-slate-800 hover:text-white">
          Executive Dashboard
        </Link>
        <Link href="/inventory" className="block rounded px-3 py-2 text-sm text-slate-300 hover:bg-slate-800 hover:text-white">
          Inventory
        </Link>
        <Link href="/vendors" className="block rounded px-3 py-2 text-sm text-slate-300 hover:bg-slate-800 hover:text-white">
          Vendors
        </Link>
      </nav>
    </aside>
  );
}