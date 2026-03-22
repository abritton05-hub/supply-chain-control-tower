'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { groupSearchResults, searchGlobal } from '@/lib/search/global-search';

export function GlobalSearch() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const results = useMemo(() => searchGlobal(query).slice(0, 20), [query]);
  const sections = useMemo(() => groupSearchResults(results), [results]);
  const flat = sections.flatMap((section) => section.rows);

  const openRow = (idx: number) => {
    const row = flat[idx];
    if (!row) return;
    router.push(row.route);
    setOpen(false);
    setQuery('');
    setActiveIndex(0);
  };

  return (
    <div className="relative w-[420px]">
      <input
        value={query}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          setActiveIndex(0);
        }}
        onKeyDown={(e) => {
          if (!open || flat.length === 0) return;
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActiveIndex((prev) => (prev + 1) % flat.length);
          }
          if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActiveIndex((prev) => (prev - 1 + flat.length) % flat.length);
          }
          if (e.key === 'Enter') {
            e.preventDefault();
            openRow(activeIndex);
          }
          if (e.key === 'Escape') {
            setOpen(false);
          }
        }}
        placeholder="Site Search"
        className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm placeholder:italic placeholder:font-light placeholder:text-slate-400"
      />

      {open && query.trim() ? (
        <div className="absolute right-0 z-50 mt-1 max-h-[420px] w-full overflow-auto rounded border border-slate-300 bg-white shadow-sm">
          {sections.length === 0 ? (
            <div className="px-3 py-3 text-sm text-slate-500">No results</div>
          ) : (
            sections.map((section) => (
              <div key={section.group} className="border-t border-slate-200 first:border-t-0">
                <div className="bg-slate-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{section.group}</div>
                {section.rows.map((row) => {
                  const idx = flat.findIndex((r) => r.id === row.id);
                  const active = idx === activeIndex;
                  return (
                    <button
                      key={row.id}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => openRow(idx)}
                      className={`flex w-full items-start gap-2 border-t border-slate-100 px-3 py-2 text-left text-sm ${active ? 'bg-cyan-50' : 'bg-white hover:bg-slate-50'}`}
                    >
                      <span className="rounded border border-slate-300 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">{row.typeLabel}</span>
                      <span className="font-semibold text-slate-800">{row.primary}</span>
                      {row.secondary ? <span className="text-slate-500">· {row.secondary}</span> : null}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
