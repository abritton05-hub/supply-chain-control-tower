'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScanCameraButton } from '@/components/scan-camera-button';

import type { InventoryRecord } from './types';

type Props = {
  inventory: InventoryRecord[];
};

type CountCapture = {
  id: string;
  item_id: string;
  part_number: string;
  description: string;
  location: string;
  countedQty: number;
};

type AppRole = 'admin' | 'ops_manager' | 'warehouse' | 'viewer';

function statusTone(status: string) {
  if (status === 'OUT') return 'bg-rose-50 text-rose-700 border-rose-200';
  if (status === 'LOW STOCK') return 'bg-amber-50 text-amber-700 border-amber-200';
  return 'bg-emerald-50 text-emerald-700 border-emerald-200';
}

function getStatus(qtyOnHand: number, reorderPoint: number) {
  if (qtyOnHand <= 0) return 'OUT';
  if (qtyOnHand <= reorderPoint) return 'LOW STOCK';
  return 'IN STOCK';
}

function findExactInventory(inventory: InventoryRecord[], value: string) {
  const cleanValue = value.trim().toLowerCase();
  if (!cleanValue) return undefined;

  return inventory.find(
    (item) =>
      !(item.is_supply ?? false) &&
      (item.item_id.toLowerCase() === cleanValue ||
        item.part_number?.toLowerCase() === cleanValue ||
        item.location?.toLowerCase() === cleanValue)
  );
}

function canEditInventory(role: AppRole) {
  return role === 'admin' || role === 'ops_manager' || role === 'warehouse';
}

export function InventoryClient({ inventory }: Props) {
  const [role, setRole] = useState<AppRole>('viewer');
  const [query, setQuery] = useState('');
  const [countItem, setCountItem] = useState<InventoryRecord | null>(null);
  const [countQty, setCountQty] = useState(0);
  const [countCaptures, setCountCaptures] = useState<CountCapture[]>([]);
  const [countMessage, setCountMessage] = useState(
    'Scan an item, part number, bin, or location to start a count.'
  );

  useEffect(() => {
    async function loadRole() {
      try {
        const response = await fetch('/api/users/me', { cache: 'no-store' });
        const result = await response.json();
        if (result?.ok && result.profile?.role) {
          setRole(result.profile.role as AppRole);
        }
      } catch {
        setRole('viewer');
      }
    }

    loadRole();
  }, []);

  const inventoryOnly = useMemo(
    () => inventory.filter((item) => !(item.is_supply ?? false)),
    [inventory]
  );

  const filteredInventory = useMemo(() => {
    const value = query.trim().toLowerCase();
    if (!value) return inventoryOnly;

    return inventoryOnly.filter((item) =>
      `${item.item_id} ${item.part_number ?? ''} ${item.description} ${item.category ?? ''} ${
        item.location ?? ''
      }`
        .toLowerCase()
        .includes(value)
    );
  }, [inventoryOnly, query]);

  const canEdit = canEditInventory(role);

  const handleInventoryScan = useCallback(
    (value: string) => {
      const scanned = value.trim();
      if (!scanned) return;

      setQuery(scanned);
      const match = findExactInventory(inventoryOnly, scanned);

      if (match) {
        setCountItem(match);
        setCountQty(match.qty_on_hand ?? 0);
        setCountMessage(`Ready to count ${match.part_number || match.item_id}.`);
      } else {
        setCountItem(null);
        setCountQty(0);
        setCountMessage('No exact match yet. Review the search results below.');
      }
    },
    [inventoryOnly]
  );

  function captureCount() {
    if (!countItem) {
      setCountMessage('Select a scanned inventory item before recording a count.');
      return;
    }

    setCountCaptures((prev) => [
      {
        id: `${countItem.id}-${Date.now()}`,
        item_id: countItem.item_id,
        part_number: countItem.part_number ?? '',
        description: countItem.description,
        location: countItem.location ?? '',
        countedQty: countQty,
      },
      ...prev,
    ]);

    setCountMessage(`Captured count for ${countItem.part_number || countItem.item_id}.`);
    setCountItem(null);
    setCountQty(0);
    setQuery('');
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="erp-panel p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0 flex-1">
            <label className="mb-1 block text-sm font-semibold text-slate-800" htmlFor="inventory-search">
              Search or Scan Inventory
            </label>
            <input
              id="inventory-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  handleInventoryScan(query);
                }
              }}
              className="w-full rounded-md border border-slate-300 px-3 py-3 text-base lg:py-2 lg:text-sm"
              placeholder="Scan item ID, part number, bin, location, or type to search"
            />
            <p className="mt-2 text-xs text-slate-500">
              Keyboard scanners work here as plain text. Exact scans prepare the count workflow.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <ScanCameraButton onScan={handleInventoryScan} />

            {canEdit ? (
              <Link
                href="/inventory-adjust?mode=add"
                className="rounded-md bg-cyan-700 px-4 py-3 text-sm font-semibold text-white hover:bg-cyan-800 lg:py-2"
              >
                Inventory Adjust
              </Link>
            ) : null}

            {query ? (
              <button
                type="button"
                onClick={() => {
                  setQuery('');
                  setCountItem(null);
                }}
                className="rounded-md border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 lg:py-2"
              >
                Clear
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <div className="erp-panel p-4 lg:hidden">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Cycle Count Capture</h2>
            <p className="mt-1 text-sm text-slate-500">Basic scan count support for field checks.</p>
          </div>
          <span className="rounded-full border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600">
            {countCaptures.length} saved
          </span>
        </div>

        <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 p-3">
          {countItem ? (
            <>
              <div className="text-sm font-semibold text-slate-900">
                {countItem.part_number || countItem.item_id}
              </div>
              <div className="mt-1 text-sm text-slate-600">{countItem.description}</div>
              <div className="mt-2 text-xs text-slate-500">Location / Bin: {countItem.location || '-'}</div>

              <label className="mt-3 block text-sm font-medium text-slate-700">Counted Qty</label>
              <input
                type="number"
                min={0}
                value={countQty}
                onChange={(event) => setCountQty(Number(event.target.value) || 0)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-3 text-base"
              />

              <button
                type="button"
                onClick={captureCount}
                className="mt-3 w-full rounded-md bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800"
              >
                Record Count
              </button>
            </>
          ) : (
            <p className="text-sm text-slate-600">{countMessage}</p>
          )}
        </div>

        {countCaptures.length ? (
          <div className="mt-3 space-y-2">
            {countCaptures.slice(0, 3).map((capture) => (
              <div key={capture.id} className="rounded-md border border-slate-200 bg-white p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold text-slate-900">
                    {capture.part_number || capture.item_id}
                  </div>
                  <div className="rounded-md border border-slate-200 px-2 py-1 text-sm font-semibold">
                    Count {capture.countedQty}
                  </div>
                </div>
                <div className="mt-1 text-xs text-slate-500">{capture.location || 'No location'}</div>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <div className="space-y-3 lg:hidden">
        {filteredInventory.length === 0 ? (
          <div className="erp-panel p-5 text-center text-sm text-slate-500">
            No inventory records found in Supabase.
          </div>
        ) : (
          filteredInventory.map((item) => {
            const qtyOnHand = item.qty_on_hand ?? 0;
            const reorderPoint = item.reorder_point ?? 0;
            const status = getStatus(qtyOnHand, reorderPoint);

            return (
              <article key={item.id} className="erp-panel p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <Link
                      href={`/inventory/${item.item_id}`}
                      className="text-base font-semibold text-cyan-700 hover:underline"
                    >
                      {item.part_number || item.item_id}
                    </Link>
                    <p className="mt-1 text-sm text-slate-600">{item.description}</p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full border px-2 py-1 text-xs font-semibold ${statusTone(status)}`}
                  >
                    {status}
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                    <div className="text-xs font-semibold uppercase text-slate-500">Qty On Hand</div>
                    <div className="mt-1 text-lg font-semibold text-slate-900">{qtyOnHand}</div>
                  </div>
                  <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                    <div className="text-xs font-semibold uppercase text-slate-500">Location / Bin</div>
                    <div className="mt-1 font-semibold text-slate-900">{item.location || '-'}</div>
                  </div>
                </div>

                <div className="mt-4 flex gap-2">
                  <Link
                    href={`/pull-requests?item=${encodeURIComponent(item.part_number || item.item_id)}`}
                    className="flex-1 rounded-md bg-cyan-700 px-4 py-3 text-center text-sm font-semibold text-white hover:bg-cyan-800"
                  >
                    Request Item
                  </Link>

                  <button
                    type="button"
                    onClick={() => {
                      setCountItem(item);
                      setCountQty(qtyOnHand);
                      setCountMessage(`Ready to count ${item.part_number || item.item_id}.`);
                    }}
                    className="rounded-md border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Count
                  </button>
                </div>
              </article>
            );
          })
        )}
      </div>

      <div className="erp-panel hidden overflow-hidden lg:block">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Item ID</th>
                <th className="px-4 py-3">Part Number</th>
                <th className="px-4 py-3">Description</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Location</th>
                <th className="px-4 py-3">Qty On Hand</th>
                <th className="px-4 py-3">Reorder Point</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>

            <tbody>
              {filteredInventory.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                    No inventory records found in Supabase.
                  </td>
                </tr>
              ) : (
                filteredInventory.map((item) => {
                  const qtyOnHand = item.qty_on_hand ?? 0;
                  const reorderPoint = item.reorder_point ?? 0;
                  const status = getStatus(qtyOnHand, reorderPoint);

                  return (
                    <tr key={item.id} className="border-b border-slate-100 align-top">
                      <td className="px-4 py-3 font-medium text-slate-900">
                        <Link href={`/inventory/${item.item_id}`} className="text-cyan-700 hover:underline">
                          {item.item_id}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-slate-700">{item.part_number || '-'}</td>
                      <td className="px-4 py-3 text-slate-700">{item.description}</td>
                      <td className="px-4 py-3 text-slate-700">{item.category || '-'}</td>
                      <td className="px-4 py-3 text-slate-700">{item.location || '-'}</td>
                      <td className="px-4 py-3 text-slate-700">{qtyOnHand}</td>
                      <td className="px-4 py-3 text-slate-700">{reorderPoint}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full border px-2 py-1 text-xs font-semibold ${statusTone(
                            status
                          )}`}
                        >
                          {status}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}