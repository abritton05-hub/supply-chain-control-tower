'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

type SidebarProps = {
  isAdmin?: boolean;
};

const baseNavSections = [
  {
    title: 'Dashboards',
    links: [
      { href: '/executive-dashboard', label: 'Executive Dashboard', icon: '📊' },
      { href: '/control-tower', label: 'Control Tower', icon: '🗼' },
      { href: '/inventory-risk', label: 'Inventory Risk', icon: '⚠️' },
      { href: '/freight-dashboard', label: 'Freight Dashboard', icon: '🚚' },
      { href: '/project-dashboard', label: 'Project Dashboard', icon: '📁' },
      { href: '/traceability-dashboard', label: 'Traceability Dashboard', icon: '🔎' },
    ],
  },
  {
    title: 'Operations',
    links: [
      { href: '/transactions', label: 'Inventory Transactions', icon: '🧾' },
      { href: '/serial-traceability', label: 'Serial Traceability', icon: '🏷️' },
      { href: '/projects-builds', label: 'Projects / Builds', icon: '🛠️' },
      { href: '/shipment-log', label: 'Shipment Log', icon: '📦' },
      { href: '/freight-quotes', label: 'Freight Quotes', icon: '💲' },
      { href: '/open-pos', label: 'Open POs', icon: '📋' },
    ],
  },
  {
    title: 'Master Data',
    links: [
      { href: '/inventory', label: 'Inventory', icon: '📚' },
      { href: '/vendors', label: 'Vendors', icon: '🏢' },
      { href: '/locations', label: 'Locations', icon: '📍' },
      { href: '/departments', label: 'Departments', icon: '🧩' },
    ],
  },
];

const adminSection = {
  title: 'Admin',
  links: [
    { href: '/users', label: 'Users', icon: '👤' },
    { href: '/rootstock', label: 'Rootstock Master', icon: '🧠' },
  ],
};

export function Sidebar({ isAdmin = false }: SidebarProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('sidebar-collapsed');
    if (saved === 'true') setCollapsed(true);
  }, []);

  useEffect(() => {
    localStorage.setItem('sidebar-collapsed', String(collapsed));
  }, [collapsed]);

  const navSections = isAdmin ? [...baseNavSections, adminSection] : baseNavSections;

  return (
    <aside
      className={`h-screen flex-shrink-0 border-r border-slate-300 bg-white text-slate-900 transition-all duration-300 ${
        collapsed ? 'w-24 p-3' : 'w-80 p-6'
      }`}
    >
      <div
        className={`mb-6 border-b border-slate-300 pb-4 ${
          collapsed ? 'flex justify-center' : 'flex items-start justify-between gap-3'
        }`}
      >
        {!collapsed ? (
          <>
            <Link href="/executive-dashboard" className="block w-full">
              <div className="relative mx-auto h-[190px] w-full max-w-[260px]">
                <Image
                  src="/logo.png"
                  alt="SCC Tower"
                  fill
                  priority
                  className="object-contain"
                  sizes="260px"
                />
              </div>
            </Link>

            <button
              type="button"
              onClick={() => setCollapsed(true)}
              className="mt-10 rounded-xl border border-slate-300 bg-white px-2 py-1 text-sm shadow-sm hover:bg-slate-50"
              aria-label="Collapse sidebar"
              title="Collapse sidebar"
            >
              ⬅️
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setCollapsed(false)}
            className="rounded-xl border border-slate-300 bg-white px-2 py-1 text-sm shadow-sm hover:bg-slate-50"
            aria-label="Expand sidebar"
            title="Expand sidebar"
          >
            ➡️
          </button>
        )}
      </div>

      <nav className="space-y-6">
        {navSections.map((section) => (
          <div key={section.title}>
            {!collapsed ? (
              <div className="mb-2 px-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                {section.title}
              </div>
            ) : null}

            <div className="space-y-2">
              {section.links.map((link) => {
                const active = pathname === link.href || pathname.startsWith(`${link.href}/`);

                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    title={collapsed ? link.label : undefined}
                    className={`flex items-center gap-3 rounded-2xl transition ${
                      collapsed
                        ? 'justify-center px-2 py-3'
                        : 'px-4 py-3 text-[16px] font-semibold'
                    } ${
                      active
                        ? 'bg-slate-100 text-slate-950 shadow-md ring-1 ring-slate-200'
                        : 'text-slate-900 hover:bg-slate-100 hover:text-slate-950'
                    }`}
                  >
                    <span className="text-lg">{link.icon}</span>
                    {!collapsed ? <span>{link.label}</span> : null}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  );
}