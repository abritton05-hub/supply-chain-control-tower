'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

type SidebarProps = {
  isAdmin?: boolean;
};

type NavLink = {
  href: string;
  label: string;
  icon: string;
  matchHrefs?: string[];
};

const baseNavLinks: NavLink[] = [
  { href: '/project-dashboard', label: 'Project Dashboard', icon: '📁' },
  { href: '/inventory', label: 'Inventory', icon: '📦' },
  { href: '/ai-document-intake', label: 'AI Document Intake', icon: '📎' },
  { href: '/pull-requests', label: 'Pull Requests', icon: '📄' },
  { href: '/kit-tracker', label: 'Kit Tracker', icon: '🧰' },
  { href: '/receiving', label: 'Receiving', icon: '📥' },
  { href: '/transactions', label: 'Transactions', icon: '📊' },
  {
    href: '/delivery',
    label: 'Shipping & Delivery',
    icon: '🚚',
    matchHrefs: ['/bom', '/driver-manifest', '/shipping'],
  },
];

const adminLinks: NavLink[] = [{ href: '/users', label: 'Users / Access', icon: '👤' }];

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

  const navLinks = isAdmin ? [...baseNavLinks, ...adminLinks] : baseNavLinks;

  return (
    <aside
      className={`flex-shrink-0 border-b border-slate-300 bg-white text-slate-900 transition-all duration-300 print:hidden lg:h-screen lg:border-b-0 lg:border-r ${
        collapsed ? 'lg:w-24 lg:p-3' : 'lg:w-[330px] lg:p-6'
      }`}
    >
      <div
        className={`hidden lg:mb-6 lg:flex ${
          collapsed ? 'justify-center' : 'items-start justify-between gap-3'
        }`}
      >
        {!collapsed ? (
          <>
            <Link href="/project-dashboard" className="block w-full">
              <div className="flex flex-col items-center text-center">
                <Image
                  src="/denali-logo.png"
                  alt="Denali Logistics SEA991"
                  width={235}
                  height={150}
                  priority
                  className="h-auto w-auto object-contain"
                />

                <div className="-mt-1 text-[1rem] font-medium tracking-[0.03em] text-slate-800">
                  Logistics SEA991
                </div>

                <div className="mt-3 text-[0.82rem] text-slate-500">
                  Powered by{' '}
                  <span className="font-semibold tracking-[0.08em] text-slate-700">
                    SCCT
                  </span>
                  <sup className="ml-0.5 text-[0.65em] align-super text-slate-500">TM</sup>
                </div>

                <div className="mt-5 w-full border-t border-slate-300" />
              </div>
            </Link>

            <button
              type="button"
              onClick={() => setCollapsed(true)}
              className="mt-8 rounded-full border border-slate-300 bg-white px-4 py-3 text-sm shadow-sm transition hover:bg-slate-50"
            >
              ←
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setCollapsed(false)}
            className="rounded-full border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm transition hover:bg-slate-50"
          >
            →
          </button>
        )}
      </div>

      <nav className="flex gap-2 overflow-x-auto px-3 py-3 lg:block lg:space-y-3 lg:overflow-visible lg:p-0">
        {navLinks.map((link) => {
          const matchHrefs = [link.href, ...(link.matchHrefs ?? [])];
          const active = matchHrefs.some(
            (href) => pathname === href || pathname.startsWith(`${href}/`)
          );

          return (
            <Link
              key={link.href}
              href={link.href}
              title={collapsed ? link.label : undefined}
              className={`flex items-center gap-4 rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                active
                  ? 'bg-slate-100 text-slate-950 shadow-sm'
                  : 'bg-white text-slate-800 hover:bg-slate-100'
              }`}
            >
              <span className="text-[1.7rem] leading-none">{link.icon}</span>
              <span className={collapsed ? 'hidden' : 'text-[1rem]'}>{link.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}