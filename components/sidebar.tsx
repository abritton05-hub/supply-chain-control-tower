'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const links = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/control-tower', label: 'Control Tower' },
  { href: '/inventory', label: 'Inventory' },
  { href: '/transactions', label: 'Transactions' },
  { href: '/serial-traceability', label: 'Serial Traceability' },
  { href: '/projects', label: 'Projects' },
  { href: '/shipment-log', label: 'Shipment Log' },
  { href: '/freight-quotes', label: 'Freight Quotes' },
  { href: '/vendors', label: 'Vendors' },
  { href: '/open-pos', label: 'Open POs' },
  { href: '/analytics', label: 'Analytics' },
  { href: '/settings', label: 'Settings' },
  { href: '/blueprint', label: 'Blueprint' },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="h-screen w-64 flex-shrink-0 border-r border-slate-800 bg-slate-900 p-4 text-slate-200">
      <h1 className="mb-6 text-sm font-semibold uppercase tracking-widest text-slate-400">Supply Chain Control Tower</h1>
      <nav className="space-y-1">
        {links.map((link) => {
          const active = pathname === link.href;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`block rounded px-3 py-2 text-sm transition ${
                active ? 'bg-cyan-600 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              {link.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
