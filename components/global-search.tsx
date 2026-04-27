'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { GlobalSearchResult, GlobalSearchResultType } from '@/lib/search/global-search';

type SearchResponse = {
  ok?: boolean;
  results?: GlobalSearchResult[];
  message?: string;
};

const GROUP_ORDER: GlobalSearchResultType[] = [
  'inventory',
  'pull_request',
  'delivery_manifest',
  'bom',
  'address_book',
  'transaction',
];

const GROUP_LABELS: Record<GlobalSearchResultType, string> = {
  inventory: 'Inventory',
  pull_request: 'Pull Requests',
  delivery_manifest: 'Delivery / Manifest',
  bom: 'BOM',
  address_book: 'Address Book',
  transaction: 'Transactions',
};

const BADGE_STYLES: Record<GlobalSearchResultType, string> = {
  inventory: 'border-cyan-200 bg-cyan-50 text-cyan-800',
  pull_request: 'border-violet-200 bg-violet-50 text-violet-800',
  delivery_manifest: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  bom: 'border-amber-200 bg-amber-50 text-amber-800',
  address_book: 'border-slate-200 bg-slate-100 text-slate-700',
  transaction: 'border-blue-200 bg-blue-50 text-blue-800',
};

function groupResults(results: GlobalSearchResult[]) {
  return GROUP_ORDER.map((type) => ({
    type,
    label: GROUP_LABELS[type],
    results: results.filter((result) => result.type === type),
  })).filter((group) => group.results.length > 0);
}

export function GlobalSearch() {
  const router = useRouter();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GlobalSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState('');

  const trimmedQuery = query.trim();
  const grouped = useMemo(() => groupResults(results), [results]);
  const shouldShowEmpty =
    isOpen && !isLoading && !error && trimmedQuery.length >= 2 && results.length === 0;

  useEffect(() => {
    function handleDocumentPointerDown(event: MouseEvent) {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleDocumentPointerDown);

    return () => document.removeEventListener('mousedown', handleDocumentPointerDown);
  }, []);

  useEffect(() => {
    if (trimmedQuery.length < 2) {
      setResults([]);
      setError('');
      setIsLoading(false);
      setIsOpen(false);
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setIsLoading(true);
      setError('');

      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(trimmedQuery)}`, {
          cache: 'no-store',
          signal: controller.signal,
        });
        const payload = (await response.json()) as SearchResponse;

        if (!response.ok || !payload.ok) {
          setResults([]);
          setError(payload.message || 'Search is unavailable.');
          return;
        }

        setResults(payload.results ?? []);
        setIsOpen(true);
      } catch (searchError) {
        if (searchError instanceof DOMException && searchError.name === 'AbortError') {
          return;
        }

        setResults([]);
        setError('Search is unavailable.');
      } finally {
        setIsLoading(false);
      }
    }, 250);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [trimmedQuery]);

  function openResult(result: GlobalSearchResult | undefined) {
    if (!result) return;

    setIsOpen(false);
    setQuery('');
    setResults([]);
    router.push(result.href);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') {
      event.preventDefault();
      setIsOpen(false);
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      openResult(results[0]);
    }
  }

  return (
    <div ref={wrapperRef} className="relative w-full">
      <label className="sr-only" htmlFor="global-search">
        Global search
      </label>
      <input
        id="global-search"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          if (event.target.value.trim().length >= 2) {
            setIsOpen(true);
          }
        }}
        onFocus={() => {
          if (trimmedQuery.length >= 2) setIsOpen(true);
        }}
        onKeyDown={handleKeyDown}
        className="h-11 w-full rounded-md border border-slate-300 bg-white px-3 pr-10 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100"
        placeholder="Search item, PR, manifest, PO..."
        autoComplete="off"
      />

      <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
        {isLoading ? (
          <span className="block h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-cyan-700" />
        ) : (
          <svg
            viewBox="0 0 24 24"
            aria-hidden="true"
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
        )}
      </div>

      {isOpen && trimmedQuery.length >= 2 ? (
        <div className="absolute left-0 right-0 z-[70] mt-2 overflow-hidden rounded-md border border-slate-200 bg-white shadow-xl">
          <div className="max-h-[420px] overflow-y-auto py-2">
            {isLoading && results.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-slate-500">Searching...</div>
            ) : null}

            {error ? (
              <div className="px-4 py-6 text-center text-sm text-rose-600">{error}</div>
            ) : null}

            {shouldShowEmpty ? (
              <div className="px-4 py-6 text-center text-sm text-slate-500">
                No results found.
              </div>
            ) : null}

            {!error
              ? grouped.map((group) => (
                  <div key={group.type} className="py-1">
                    <div className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                      {group.label}
                    </div>
                    <div>
                      {group.results.map((result) => (
                        <button
                          key={`${result.type}-${result.id}`}
                          type="button"
                          onClick={() => openResult(result)}
                          className="block w-full px-3 py-2.5 text-left transition hover:bg-slate-50 focus:bg-slate-50 focus:outline-none"
                        >
                          <div className="flex min-w-0 items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="truncate text-sm font-semibold text-slate-900">
                                {result.title}
                              </div>
                              <div className="mt-0.5 line-clamp-2 text-xs leading-5 text-slate-600">
                                {result.subtitle}
                              </div>
                              {result.matchedField ? (
                                <div className="mt-1 text-[11px] font-medium text-slate-500">
                                  Matched {result.matchedField}
                                </div>
                              ) : null}
                            </div>
                            <span
                              className={`shrink-0 rounded-full border px-2 py-1 text-[11px] font-bold ${BADGE_STYLES[result.type]}`}
                            >
                              {result.badge || GROUP_LABELS[result.type]}
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                ))
              : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
