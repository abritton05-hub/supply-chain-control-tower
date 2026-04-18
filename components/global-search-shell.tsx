'use client';

import { useState } from 'react';

const SEARCH_TARGETS = [
  'tracking number',
  'part number',
  'item id',
  'description',
  'rack',
  'kit number',
  'location',
  'BOM number',
  'reference',
];

export function GlobalSearchShell() {
  const [query, setQuery] = useState('');

  return (
    <div className="relative w-full max-w-2xl">
      <label className="sr-only" htmlFor="global-search">
        Global search
      </label>
      <input
        id="global-search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search tracking, part, item, kit, location, BOM, reference"
        className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm placeholder:text-slate-400"
      />

      {query.trim() ? (
        <div className="absolute left-0 right-0 z-50 mt-1 rounded border border-slate-300 bg-white p-3 text-sm text-slate-600 shadow-sm">
          Search indexing is not connected yet. This bar is reserved for{' '}
          {SEARCH_TARGETS.join(', ')}.
        </div>
      ) : null}
    </div>
  );
}
