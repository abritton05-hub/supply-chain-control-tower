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
  { href: '/dashboard', label: 'Executive Dashboard', icon: '📊' },
  { href: '/inventory', label: 'Inventory', icon: '📦' },
  { href: '/ai-document-intake', label: 'AI Document Intake', icon: '📎' },
  { href: '/pull-requests', label: 'Pull Requests', icon: '📄' },
  { href: '/kit-tracker', label: 'Kit Tracker', icon: '🧰' },
  { href: '/receiving', label: 'Receiving', icon: '📥' },
  { href: '/transactions', label: 'Transactions', icon: '📊' },
  { href: '/address-book', label: 'Address Book', icon: '📍' },
  {
    href: '/delivery',
    label: 'Shipping',
    icon: '🚚',
    matchHrefs: ['/bom', '/driver-manifest', '/shipping'],
  },
];

const adminLinks: NavLink[] = [{ href: '/users', label: 'Users / Access', icon: '👤' }];

export function Sidebar({ isAdmin = false }: SidebarProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [logoFailed, setLogoFailed] = useState(false);

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
      className={`sticky top-0 z-30 flex-shrink-0 border-b border-slate-300 bg-white text-slate-900 shadow-sm transition-all duration-300 print:hidden lg:h-screen lg:border-b-0 lg:border-r lg:shadow-none ${
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
            <Link href="/inventory" className="block w-full">
              <div className="flex flex-col items-center text-center">
                {!logoFailed ? (
                  <Image
                    src="/denali-logo.png"
                    alt="Denali Logistics SEA991"
                    width={235}
                    height={120}
                    priority
                    className="h-auto w-auto object-contain"
                    onError={() => setLogoFailed(true)}
                  />
                ) : (
                  <div className="flex h-[120px] w-full items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 px-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold tracking-wide text-slate-900">
                        DENALI
                      </div>
                      <div className="mt-2 text-base font-medium text-slate-600">
                        Logistics SEA991
                      </div>
                    </div>
                  </div>
                )}

                <div className="mt-2 text-[1rem] font-medium tracking-[0.03em] text-slate-800">
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
              aria-label="Collapse sidebar"
            >
              ←
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setCollapsed(false)}
            className="rounded-full border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm transition hover:bg-slate-50"
            aria-label="Expand sidebar"
          >
            →
          </button>
        )}
      </div>

      <nav className="scrollbar-thin flex gap-2 overflow-x-auto px-3 py-2 lg:block lg:space-y-3 lg:overflow-visible lg:p-0">
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
              className={`flex min-h-11 shrink-0 items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold transition lg:gap-4 lg:px-4 lg:py-3 ${
                active
                  ? 'bg-slate-100 text-slate-950 shadow-sm'
                  : 'bg-white text-slate-800 hover:bg-slate-100'
              }`}
            >
              <span className="text-[1.35rem] leading-none lg:text-[1.7rem]">{link.icon}</span>
              <span className={`${collapsed ? 'hidden' : 'max-w-[9rem] truncate text-sm lg:max-w-none lg:text-[1rem]'}`}>
                {link.label}
              </span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
