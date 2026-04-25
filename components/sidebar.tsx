'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

type SidebarProps = {
  isAdmin?: boolean;
};

export function Sidebar({ isAdmin = false }: SidebarProps) {
  const pathname = usePathname();

  const links = [
    { href: '/dashboard', label: 'Executive Dashboard' },
    { href: '/inventory', label: 'Inventory' },
    { href: '/ai-document-intake', label: 'AI Document Intake' },
    { href: '/pull-requests', label: 'Pull Requests' },
    { href: '/kit-tracker', label: 'Kit Tracker' },
    { href: '/receiving', label: 'Receiving' },
    { href: '/transactions', label: 'Transactions' },
    { href: '/delivery', label: 'Shipping & Delivery' },
  ];

  if (isAdmin) {
    links.push({ href: '/users', label: 'Users / Access' });
  }

  return (
    <aside className="w-[260px] border-r bg-white p-4">
      <h1 className="mb-6 text-lg font-bold">SCCT</h1>

      <nav className="space-y-2">
        {links.map((link) => {
          const active = pathname.startsWith(link.href);

          return (
            <Link
              key={link.href}
              href={link.href}
              className={`block rounded px-3 py-2 text-sm ${
                active ? 'bg-slate-200 font-semibold' : 'hover:bg-slate-100'
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