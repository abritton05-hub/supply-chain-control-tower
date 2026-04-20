'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';

type PageSearchItem = {
  type: 'page';
  label: string;
  href: string;
  keywords: string[];
  description: string;
  meta?: string;
};

type ApiSearchItem = {
  type: 'page' | 'inventory' | 'pull_request' | 'transaction' | 'location';
  label: string;
  href: string;
  description: string;
  meta?: string;
  score?: number;
};

type SearchResult = PageSearchItem | ApiSearchItem;

const PAGE_ITEMS: PageSearchItem[] = [
  {
    type: 'page',
    label: 'Executive Dashboard',
    href: '/executive-dashboard',
    keywords: ['dashboard', 'executive', 'home', 'overview', 'kpi', 'metrics'],
    description: 'Executive overview and KPI dashboard',
  },
  {
    type: 'page',
    label: 'Project Dashboard',
    href: '/project-dashboard',
    keywords: ['project', 'projects', 'builds', 'work', 'project dashboard'],
    description: 'Project activity and build visibility',
  },
  {
    type: 'page',
    label: 'Inventory',
    href: '/inventory',
    keywords: ['inventory', 'stock', 'parts', 'items', 'on hand', 'materials'],
    description: 'Inventory records and part visibility',
  },
  {
    type: 'page',
    label: 'AI Document Intake',
    href: '/ai-document-intake',
    keywords: ['ai intake', 'document intake', 'upload document', 'extract fields', 'classify document'],
    description: 'Classify documents and prepare workflow drafts',
  },
  {
    type: 'page',
    label: 'Receiving',
    href: '/receiving',
    keywords: ['receiving', 'receive', 'receipt', 'receipts', 'inbound', 'dock'],
    description: 'Receive material and post receipts',
  },
  {
    type: 'page',
    label: 'Transactions',
    href: '/transactions',
    keywords: ['transactions', 'history', 'moves', 'receipts', 'issues', 'audit'],
    description: 'Inventory transaction history',
  },
  {
    type: 'page',
    label: 'Pull Requests',
    href: '/pull-requests',
    keywords: ['pull requests', 'pull', 'request', 'material request', 'pick list'],
    description: 'Create and manage pull requests',
  },
  {
    type: 'page',
    label: 'Kit Tracker',
    href: '/kit-tracker',
    keywords: ['kit', 'kits', 'tracker', 'build', 'assembly', 'bom'],
    description: 'Track kits and kit-related activity',
  },
  {
    type: 'page',
    label: 'Shipping & Delivery',
    href: '/delivery',
    keywords: ['shipping', 'delivery', 'driver', 'manifest', 'drop off', 'pickup'],
    description: 'Shipping and delivery operations',
  },
  {
    type: 'page',
    label: 'BOM',
    href: '/bom',
    keywords: ['bom', 'bill of materials', 'print bom', 'materials'],
    description: 'Build and print BOM documents',
  },
  {
    type: 'page',
    label: 'Driver Manifest',
    href: '/driver-manifest',
    keywords: ['manifest', 'driver manifest', 'pickup manifest', 'delivery manifest'],
    description: 'Build and print driver manifests',
  },
  {
    type: 'page',
    label: 'Locations',
    href: '/locations',
    keywords: ['locations', 'bins', 'warehouse', 'site', 'storage'],
    description: 'Location management and lookup',
  },
  {
    type: 'page',
    label: 'Users / Access',
    href: '/users',
    keywords: ['users', 'access', 'admin', 'permissions', 'roles'],
    description: 'User and access management',
  },
];

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '').trim();
}

function scorePageItem(item: PageSearchItem, query: string) {
  const q = normalize(query);
  if (!q) return 0;

  const label = normalize(item.label);
  const desc = normalize(item.description);
  const keywords = item.keywords.map(normalize);

  let score = 0;

  if (label === q) score += 100;
  if (label.startsWith(q)) score += 60;
  if (label.includes(q)) score += 35;
  if (desc.includes(q)) score += 20;

  if (q.length >= 3) {
    const stem = q.slice(0, 3);
    if (label.includes(stem)) score += 18;
    if (desc.includes(stem)) score += 10;
    for (const keyword of keywords) {
      if (keyword.includes(stem)) score += 12;
    }
  }

  return score;
}

function SearchIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
      aria-hidden="true"
    >
      <path d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2a2 2 0 0 1-.6 1.4L4 17h5" />
      <path d="M9 17a3 3 0 0 0 6 0" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-6 w-6"
      aria-hidden="true"
    >
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20a8 8 0 0 1 16 0" />
    </svg>
  );
}

function getTypeLabel(type: SearchResult['type']) {
  switch (type) {
    case 'inventory':
      return 'Inventory';
    case 'pull_request':
      return 'Pull Request';
    case 'transaction':
      return 'Transaction';
    case 'location':
      return 'Location';
    default:
      return 'Page';
  }
}

export function TopHeader() {
  const router = useRouter();
  const pathname = usePathname();
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [recordResults, setRecordResults] = useState<ApiSearchItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const trimmedQuery = query.trim();

  const pageResults = useMemo(() => {
    if (trimmedQuery.length < 2) return [];

    return [...PAGE_ITEMS]
      .map((item) => ({
        item,
        score: scorePageItem(item, trimmedQuery),
      }))
      .filter((entry) => entry.score >= 20)
      .sort((a, b) => b.score - a.score || a.item.label.localeCompare(b.item.label))
      .slice(0, 4)
      .map((entry) => entry.item);
  }, [trimmedQuery]);

  const combinedResults = useMemo(() => {
    const merged = [...recordResults, ...pageResults];
    return Array.from(
      new Map(merged.map((item) => [`${item.type}:${item.label}:${item.description}`, item])).values()
    ).slice(0, 10);
  }, [pageResults, recordResults]);

  useEffect(() => {
    setActiveIndex(0);
  }, [trimmedQuery, recordResults.length]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    if (trimmedQuery.length < 2) {
      setRecordResults([]);
      setIsLoading(false);
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      try {
        setIsLoading(true);

        const res = await fetch(`/api/search?q=${encodeURIComponent(trimmedQuery)}`, {
          method: 'GET',
          signal: controller.signal,
        });

        const data = (await res.json()) as { ok?: boolean; results?: ApiSearchItem[] };

        if (!controller.signal.aborted) {
          setRecordResults(Array.isArray(data.results) ? data.results : []);
        }
      } catch {
        if (!controller.signal.aborted) {
          setRecordResults([]);
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }, 180);

    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [trimmedQuery]);

  function goToItem(item: SearchResult) {
    setOpen(false);
    setQuery('');
    if (pathname !== item.href) {
      router.push(item.href);
    }
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (combinedResults.length === 0) return;
    goToItem(combinedResults[activeIndex] ?? combinedResults[0]);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (!open && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
      if (trimmedQuery.length >= 2) setOpen(true);
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((prev) => (prev + 1) % Math.max(combinedResults.length, 1));
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex(
        (prev) => (prev - 1 + Math.max(combinedResults.length, 1)) % Math.max(combinedResults.length, 1)
      );
      return;
    }

    if (event.key === 'Escape') {
      setOpen(false);
    }
  }

  const shouldShowDropdown = open && trimmedQuery.length >= 2;

  return (
    <header className="rounded-3xl border border-slate-300 bg-white px-4 py-4 shadow-sm print:hidden sm:px-5">
      <div className="flex min-h-[72px] items-center justify-between gap-4">
        <div className="flex flex-1 justify-start">
          <div ref={wrapperRef} className="relative w-full max-w-[820px]">
            <form onSubmit={handleSubmit}>
              <label htmlFor="site-search" className="sr-only">
                Site Search
              </label>

              <div className="relative overflow-hidden rounded-2xl border border-slate-300 bg-slate-50">
                <div className="pointer-events-none absolute inset-y-0 right-5 flex items-center">
                  <span className="select-none text-[0.72rem] font-medium uppercase tracking-[0.18em] text-slate-300/80">
                    Powered by SCCT
                    <sup className="ml-0.5 text-[0.7em] align-super">TM</sup>
                  </span>
                </div>

                <div className="pointer-events-none absolute left-4 top-1/2 z-10 -translate-y-1/2 text-slate-400">
                  <SearchIcon />
                </div>

                <input
                  id="site-search"
                  type="text"
                  value={query}
                  onChange={(event) => {
                    const nextValue = event.target.value;
                    setQuery(nextValue);
                    setOpen(nextValue.trim().length >= 2);
                  }}
                  onFocus={() => {
                    if (trimmedQuery.length >= 2) setOpen(true);
                  }}
                  onKeyDown={handleKeyDown}
                  placeholder="Search pages, modules, records, and tools"
                  className="relative z-10 w-full bg-transparent py-3 pl-12 pr-[220px] text-sm italic text-slate-800 outline-none transition placeholder:text-slate-500 focus:bg-white/70"
                  autoComplete="off"
                />
              </div>
            </form>

            {shouldShowDropdown && (
              <div className="absolute left-0 right-0 top-[calc(100%+10px)] z-50 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
                <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2">
                  <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                    Global Search
                  </div>
                  <div className="text-[11px] text-slate-400">
                    {isLoading ? 'Searching...' : `${combinedResults.length} results`}
                  </div>
                </div>

                {combinedResults.length > 0 ? (
                  <ul className="max-h-96 overflow-y-auto py-2">
                    {combinedResults.map((item, index) => {
                      const active = index === activeIndex;

                      return (
                        <li key={`${item.type}-${item.label}-${item.description}`}>
                          <button
                            type="button"
                            onMouseEnter={() => setActiveIndex(index)}
                            onClick={() => goToItem(item)}
                            className={`flex w-full items-start gap-4 px-4 py-3 text-left transition ${
                              active ? 'bg-slate-100' : 'bg-white hover:bg-slate-50'
                            }`}
                          >
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-600">
                                  {getTypeLabel(item.type)}
                                </span>
                                <div className="truncate text-sm font-semibold text-slate-900">
                                  {item.label}
                                </div>
                              </div>

                              <div className="mt-1 text-xs text-slate-500">
                                {item.description}
                              </div>

                              {item.meta ? (
                                <div className="mt-1 text-[11px] text-slate-400">{item.meta}</div>
                              ) : null}
                            </div>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <div className="px-4 py-4 text-sm text-slate-500">
                    No matches found.
                  </div>
                )}

                <div className="border-t border-slate-200 px-4 py-2 text-[11px] text-slate-400">
                  Enter = open first result · ↑ ↓ = move · Esc = close
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            className="relative inline-flex h-12 w-12 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50"
            aria-label="Notifications"
          >
            <BellIcon />
            <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-red-500" />
          </button>

          <button
            type="button"
            className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50"
            aria-label="Profile"
          >
            <UserIcon />
          </button>
        </div>
      </div>
    </header>
  );
}
