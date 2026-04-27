'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { AppRole } from '@/lib/auth/roles';

type SidebarProps = {
  role: AppRole;
};

type IconKey =
  | 'dashboard'
  | 'inventory'
  | 'aiIntake'
  | 'pullRequests'
  | 'kitTracker'
  | 'receiving'
  | 'transactions'
  | 'addressBook'
  | 'delivery'
  | 'users';

type NavLink = {
  href: string;
  label: string;
  icon: IconKey;
  roles: AppRole[];
  matchHrefs?: string[];
};

const baseNavLinks: NavLink[] = [
  {
    href: '/dashboard',
    label: 'Executive Dashboard',
    icon: 'dashboard',
    roles: ['warehouse', 'admin'],
  },
  { href: '/inventory', label: 'Inventory', icon: 'inventory', roles: ['tech', 'warehouse', 'admin'] },
  {
    href: '/ai-document-intake',
    label: 'AI Document Intake',
    icon: 'aiIntake',
    roles: ['warehouse', 'admin'],
  },
  {
    href: '/pull-requests',
    label: 'Pull Requests',
    icon: 'pullRequests',
    roles: ['tech', 'warehouse', 'admin'],
  },
  { href: '/kit-tracker', label: 'Kit Tracker', icon: 'kitTracker', roles: ['warehouse', 'admin'] },
  { href: '/receiving', label: 'Receiving', icon: 'receiving', roles: ['warehouse', 'admin'] },
  { href: '/transactions', label: 'Transactions', icon: 'transactions', roles: ['warehouse', 'admin'] },
  { href: '/address-book', label: 'Address Book', icon: 'addressBook', roles: ['warehouse', 'admin'] },
  {
    href: '/delivery',
<<<<<<< HEAD
    label: 'Shipping',
    icon: '🚚',
=======
    label: 'Shipping & Delivery',
    icon: 'delivery',
    roles: ['warehouse', 'admin'],
>>>>>>> 5949f581 (Checkpoint before live launch fixes)
    matchHrefs: ['/bom', '/driver-manifest', '/shipping'],
  },
];

const adminLinks: NavLink[] = [
  { href: '/users', label: 'Users / Access', icon: 'users', roles: ['admin'] },
];

function EnterpriseIcon({ icon }: { icon: IconKey }) {
  const commonProps = {
    className: 'h-5 w-5 shrink-0',
    fill: 'none',
    stroke: 'currentColor',
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    strokeWidth: 1.8,
    viewBox: '0 0 24 24',
    'aria-hidden': true,
  };

  switch (icon) {
    case 'dashboard':
      return (
        <svg {...commonProps}>
          <rect x="3" y="3" width="7" height="8" rx="1.5" />
          <rect x="14" y="3" width="7" height="5" rx="1.5" />
          <rect x="14" y="12" width="7" height="9" rx="1.5" />
          <rect x="3" y="15" width="7" height="6" rx="1.5" />
        </svg>
      );
    case 'inventory':
      return (
        <svg {...commonProps}>
          <path d="M4 8.5 12 4l8 4.5-8 4.5-8-4.5Z" />
          <path d="M4 8.5v7L12 20l8-4.5v-7" />
          <path d="M12 13v7" />
          <path d="m8.5 6.1 8 4.5" />
        </svg>
      );
    case 'aiIntake':
      return (
        <svg {...commonProps}>
          <path d="M7 3h7l4 4v14H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" />
          <path d="M14 3v5h5" />
          <path d="M8.5 13h7" />
          <path d="M8.5 17h4" />
          <path d="M15.5 16.5 18 19" />
          <circle cx="14.5" cy="15.5" r="2" />
        </svg>
      );
    case 'pullRequests':
      return (
        <svg {...commonProps}>
          <rect x="6" y="4" width="12" height="17" rx="2" />
          <path d="M9 4.5h6" />
          <path d="M9 10h6" />
          <path d="M9 14h6" />
          <path d="M9 18h4" />
        </svg>
      );
    case 'kitTracker':
      return (
        <svg {...commonProps}>
          <path d="M5 8.5 12 5l7 3.5-7 3.5-7-3.5Z" />
          <path d="M5 8.5v7L12 19l7-3.5v-7" />
          <path d="m9.5 14 1.5 1.5 3.5-4" />
        </svg>
      );
    case 'receiving':
      return (
        <svg {...commonProps}>
          <path d="M9 4h6" />
          <path d="M9 4a2 2 0 0 0-2 2v1h10V6a2 2 0 0 0-2-2" />
          <path d="M7 7H5v14h14V7h-2" />
          <path d="m8.5 14 2.25 2.25L15.5 11.5" />
        </svg>
      );
    case 'transactions':
      return (
        <svg {...commonProps}>
          <path d="M5 7h9" />
          <path d="M5 12h14" />
          <path d="M5 17h9" />
          <path d="m16 5 3 2-3 2" />
          <path d="m16 15 3 2-3 2" />
        </svg>
      );
    case 'addressBook':
      return (
        <svg {...commonProps}>
          <path d="M6 4h11a2 2 0 0 1 2 2v14H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" />
          <path d="M8 4v16" />
          <path d="M13.5 9.5a2 2 0 1 1 0 4 2 2 0 0 1 0-4Z" />
          <path d="M10.5 17c.6-1.4 1.6-2.1 3-2.1s2.4.7 3 2.1" />
        </svg>
      );
    case 'delivery':
      return (
        <svg {...commonProps}>
          <path d="M3 6h11v10H3z" />
          <path d="M14 10h4l3 3v3h-7" />
          <path d="M6.5 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" />
          <path d="M17.5 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" />
        </svg>
      );
    case 'users':
      return (
        <svg {...commonProps}>
          <path d="M12 3.5 19 6v5.5c0 4.2-2.8 7.2-7 9-4.2-1.8-7-4.8-7-9V6l7-2.5Z" />
          <path d="M9.5 11a2.5 2.5 0 1 0 5 0 2.5 2.5 0 0 0-5 0Z" />
          <path d="M8 17c.8-1.7 2.1-2.5 4-2.5s3.2.8 4 2.5" />
        </svg>
      );
    default:
      return null;
  }
}

export function Sidebar({ role }: SidebarProps) {
  const pathname = usePathname() ?? '';
  const [collapsed, setCollapsed] = useState(false);
  const [logoFailed, setLogoFailed] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('sidebar-collapsed');
    if (saved === 'true') setCollapsed(true);
  }, []);

  useEffect(() => {
    localStorage.setItem('sidebar-collapsed', String(collapsed));
  }, [collapsed]);

  const navLinks = [...baseNavLinks, ...adminLinks].filter((link) =>
    link.roles.includes(role)
  );

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
            (href) => pathname === href || Boolean(pathname?.startsWith(`${href}/`))
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
              <span className="flex h-6 w-6 shrink-0 items-center justify-center">
                <EnterpriseIcon icon={link.icon} />
              </span>
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

