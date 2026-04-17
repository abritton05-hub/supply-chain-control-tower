'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

type NavGroup = {
  title: string;
  links: { href: string; label: string }[];
};

const nav: NavGroup[] = [
  {
    title: 'Dashboards',
    links: [
      { href: '/executive-dashboard', label: 'Executive Dashboard' },
      { href: '/control-tower', label: 'Control Tower' },
      { href: '/inventory-risk', label: 'Inventory Risk' },
      { href: '/freight-dashboard', label: 'Freight Dashboard' },
      { href: '/project-dashboard', label: 'Project Dashboard' },
      { href: '/traceability-dashboard', label: 'Traceability Dashboard' },
    ],
  },
  {
    title: 'Operations',
    links: [
      { href: '/transactions', label: 'Inventory Transactions' },
      { href: '/serial-traceability', label: 'Serial Traceability' },
      { href: '/projects-builds', label: 'Projects / Builds' },
      { href: '/shipment-log', label: 'Shipment Log' },
      { href: '/freight-quotes', label: 'Freight Quotes' },
      { href: '/open-pos', label: 'Open POs' },
    ],
  },
  {
    title: 'Master Data',
    links: [
      { href: '/inventory', label: 'Inventory Database' },
      { href: '/vendors', label: 'Vendors' },
      { href: '/locations', label: 'Locations' },
      { href: '/departments', label: 'Departments' },
      { href: '/users', label: 'Users' },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="h-screen w-72 flex-shrink-0 overflow-auto border-r border-slate-800 bg-slate-900 p-4 text-slate-200">
      <h1 className="mb-6 text-sm font-semibold uppercase tracking-widest text-slate-400">Supply Chain Control Tower</h1>
      <nav className="space-y-5">
        {nav.map((group) => (
          <section key={group.title}>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">{group.title}</p>
            <div className="space-y-1">
              {group.links.map((link) => {
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
            </div>
          </section>
        ))}
      </nav>
    </aside>
  );
}
