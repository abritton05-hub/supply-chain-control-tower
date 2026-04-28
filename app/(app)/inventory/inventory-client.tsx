'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { PrintInventoryTagButton, PrintLocationLabelButton } from '@/components/label-print-buttons';
import { ScanCameraButton } from '@/components/scan-camera-button';
import { parseScctBarcodePayload } from '@/lib/barcodes/scct-payload';
import { archiveInventoryItem } from './actions';
import type { InventoryRecord } from './types';

type Props = {
  inventory: InventoryRecord[];
  canEditInventory: boolean;
  initialQuery?: string;
  initialLocation?: string;
  initialBin?: string;
};

type CountCapture = {
  id: string;
  item_id: string;
  part_number: string;
  description: string;
  site: string;
  bin_location: string;
  countedQty: number;
};

type QuickAdjustType = 'add' | 'remove' | 'set';

type QuickAdjustResponse = {
  ok: boolean;
  message?: string;
};

const LOCATION_TABS = ['SEA991', 'WH/A13', 'SEA99', 'SEA111', 'SEA129', 'SEA133', 'SEA143'];

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

function normalizeSite(value: string | null | undefined) {
  const clean = value?.trim().toUpperCase() || '';

  if (clean === 'WH') return 'WH/A13';
  if (clean === 'A13') return 'WH/A13';
  if (clean === 'WH/A13') return 'WH/A13';

  return clean || 'SEA991';
}

function findExactInventory(inventory: InventoryRecord[], value: string) {
  const cleanValue = value.trim().toLowerCase();
  if (!cleanValue) return undefined;

  return inventory.find((item) => {
    const site = normalizeSite(item.site || item.location).toLowerCase();
    const bin = item.bin_location?.toLowerCase() || '';

    return (
      !(item.is_supply ?? false) &&
      (item.item_id.toLowerCase() === cleanValue ||
        item.part_number?.toLowerCase() === cleanValue ||
        item.location?.toLowerCase() === cleanValue ||
        site === cleanValue ||
        bin === cleanValue)
    );
  });
}

export function InventoryClient({
  inventory,
  canEditInventory: canEdit,
  initialQuery = '',
  initialLocation = '',
  initialBin = '',
}: Props) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery || initialBin);
  const [activeSite, setActiveSite] = useState(normalizeSite(initialLocation || 'SEA991'));
  const [countItem, setCountItem] = useState<InventoryRecord | null>(null);
  const [countQty, setCountQty] = useState(0);
  const [countCaptures, setCountCaptures] = useState<CountCapture[]>([]);
  const [countMessage, setCountMessage] = useState(
    'Scan an item, part number, bin, or location to start a count.'
  );
  const [quickAdjustItem, setQuickAdjustItem] = useState<InventoryRecord | null>(null);
  const [quickAdjustType, setQuickAdjustType] = useState<QuickAdjustType>('add');
  const [quickAdjustQty, setQuickAdjustQty] = useState('');
  const [quickAdjustReason, setQuickAdjustReason] = useState('');
  const [quickAdjustMessage, setQuickAdjustMessage] = useState('');
  const [quickAdjustPending, setQuickAdjustPending] = useState(false);
  const [archivePendingItemId, setArchivePendingItemId] = useState<string | null>(null);

  useEffect(() => {
    setQuery(initialQuery || initialBin);
    setActiveSite(normalizeSite(initialLocation || 'SEA991'));
  }, [initialBin, initialLocation, initialQuery]);

  const inventoryOnly = useMemo(
    () => inventory.filter((item) => !(item.is_supply ?? false)),
    [inventory]
  );

  const filteredInventory = useMemo(() => {
    const value = query.trim().toLowerCase();

    return inventoryOnly.filter((item) => {
      const site = normalizeSite(item.site || item.location);
      const matchesSite = site === activeSite;

      const searchable = `${item.item_id} ${item.part_number ?? ''} ${item.description} ${
        item.category ?? ''
      } ${item.location ?? ''} ${item.site ?? ''} ${item.bin_location ?? ''}`.toLowerCase();

      const matchesSearch = value ? searchable.includes(value) : true;

      return matchesSite && matchesSearch;
    });
  }, [inventoryOnly, query, activeSite]);

  const siteCounts = useMemo(() => {
    const counts = new Map<string, number>();

    for (const tab of LOCATION_TABS) {
      counts.set(tab, 0);
    }

    for (const item of inventoryOnly) {
      const site = normalizeSite(item.site || item.location);
      counts.set(site, (counts.get(site) || 0) + 1);
    }

    return counts;
  }, [inventoryOnly]);

  const handleInventoryScan = useCallback(
    (value: string) => {
      const scanned = value.trim();
      if (!scanned) return;

      const parsedPayload = parseScctBarcodePayload(scanned);

      if (parsedPayload?.type === 'inventory') {
        if (parsedPayload.itemId) {
          setQuery('');
          setCountItem(null);
          router.push(`/inventory/${encodeURIComponent(parsedPayload.itemId)}`);
          return;
        }

        if (parsedPayload.partNumber) {
          setQuery(parsedPayload.partNumber);
          setCountItem(null);
          setCountQty(0);
          setCountMessage(`Searching for part number ${parsedPayload.partNumber}.`);
          return;
        }
      }

      if (parsedPayload?.type === 'location') {
        if (parsedPayload.location) {
          setActiveSite(normalizeSite(parsedPayload.location));
        }

        setQuery(parsedPayload.bin || '');
        setCountItem(null);
        setCountQty(0);
        setCountMessage(
          parsedPayload.bin
            ? `Filtering inventory for ${parsedPayload.location || activeSite} / ${parsedPayload.bin}.`
            : `Filtering inventory for ${parsedPayload.location || activeSite}.`
        );
        return;
      }

      setQuery(scanned);
      const match = findExactInventory(inventoryOnly, scanned);

      if (match) {
        setActiveSite(normalizeSite(match.site || match.location));
        setCountItem(match);
        setCountQty(match.qty_on_hand ?? 0);
        setCountMessage(`Ready to count ${match.part_number || match.item_id}.`);
      } else {
        setCountItem(null);
        setCountQty(0);
        setCountMessage('No exact match yet. Review the search results below.');
      }
    },
    [activeSite, inventoryOnly, router]
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
        site: normalizeSite(countItem.site || countItem.location),
        bin_location: countItem.bin_location ?? '',
        countedQty: countQty,
      },
      ...prev,
    ]);

    setCountMessage(`Captured count for ${countItem.part_number || countItem.item_id}.`);
    setCountItem(null);
    setCountQty(0);
    setQuery('');
  }

  function openQuickAdjust(item: InventoryRecord) {
    setQuickAdjustItem(item);
    setQuickAdjustType('add');
    setQuickAdjustQty('');
    setQuickAdjustReason('');
    setQuickAdjustMessage('');
  }

  async function submitQuickAdjust() {
    if (!quickAdjustItem) return;

    const quantity = Number(quickAdjustQty);

    if (!Number.isFinite(quantity) || quantity <= 0) {
      setQuickAdjustMessage('Enter a quantity greater than 0.');
      return;
    }

    if (!quickAdjustReason.trim()) {
      setQuickAdjustMessage('Enter a reason before adjusting inventory.');
      return;
    }

    const currentQty = quickAdjustItem.qty_on_hand ?? 0;
    const nextQty =
      quickAdjustType === 'add'
        ? currentQty + quantity
        : quickAdjustType === 'remove'
          ? currentQty - quantity
          : quantity;

    if (nextQty < 0) {
      setQuickAdjustMessage('This adjustment would make inventory negative.');
      return;
    }

    setQuickAdjustPending(true);
    setQuickAdjustMessage('');

    try {
      const response = await fetch('/api/inventory-adjust', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemId: quickAdjustItem.id,
          adjustType: quickAdjustType,
          quantity,
          reason: quickAdjustReason.trim(),
          notes: quickAdjustReason.trim(),
        }),
      });
      const result = (await response.json()) as QuickAdjustResponse;

      if (!response.ok || !result.ok) {
        setQuickAdjustMessage(result.message || 'Inventory adjustment failed.');
        return;
      }

      window.location.reload();
    } catch (error) {
      setQuickAdjustMessage(error instanceof Error ? error.message : 'Inventory adjustment failed.');
    } finally {
      setQuickAdjustPending(false);
    }
  }

  async function handleArchiveInventoryItem(itemId: string, label: string) {
    if (
      !window.confirm(
        `Archive ${label}? It will disappear from active inventory while transaction history remains.`
      )
    ) {
      return;
    }

    setArchivePendingItemId(itemId);
    try {
      const result = await archiveInventoryItem(itemId);
      const detail = result.skipReasons?.length ? ` ${result.skipReasons.join(' ')}` : '';
      setCountMessage(`${result.message}${detail}`);
      if (result.ok) {
        router.refresh();
      }
    } finally {
      setArchivePendingItemId(null);
    }
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
              placeholder="Search or scan item/location..."
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

      <div className="erp-panel p-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex flex-wrap gap-2">
            {LOCATION_TABS.map((site) => (
              <button
                key={site}
                type="button"
                onClick={() => setActiveSite(site)}
                className={`rounded-md px-4 py-2 text-sm font-semibold ${
                  activeSite === site
                    ? 'bg-cyan-700 text-white'
                    : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                {site}
                <span className="ml-2 text-xs opacity-80">{siteCounts.get(site) || 0}</span>
              </button>
            ))}
          </div>

          <PrintLocationLabelButton location={activeSite} />
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
              <div className="mt-2 text-xs text-slate-500">
                Site / Bin: {normalizeSite(countItem.site || countItem.location)} /{' '}
                {countItem.bin_location || '-'}
              </div>

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
                <div className="mt-1 text-xs text-slate-500">
                  {capture.site} / {capture.bin_location || 'No bin'}
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <div className="space-y-3 lg:hidden">
        {filteredInventory.length === 0 ? (
          <div className="erp-panel p-5 text-center text-sm text-slate-500">
            No inventory records found for {activeSite}.
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
                    <div className="text-xs font-semibold uppercase text-slate-500">Site / Bin</div>
                    <div className="mt-1 font-semibold text-slate-900">
                      {normalizeSite(item.site || item.location)} / {item.bin_location || '-'}
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                  <Link
                    href={`/inventory/${item.item_id}`}
                    className="erp-action-primary inline-flex w-full justify-center sm:w-auto"
                  >
                    Open
                  </Link>
                  <PrintInventoryTagButton
                    item={item}
                    className="erp-action-secondary w-full sm:w-auto"
                    showMessage={false}
                  />
                  <PrintLocationLabelButton
                    location={normalizeSite(item.site || item.location)}
                    binLocation={item.bin_location}
                    className="erp-action-secondary w-full sm:w-auto"
                    showMessage={false}
                  />
                </div>
              </article>
            );
          })
        )}
      </div>

      <div className="erp-panel hidden overflow-hidden lg:block">
        <div className="border-b border-slate-200 px-4 py-3">
          <h2 className="text-base font-semibold text-slate-900">{activeSite} Inventory</h2>
          <p className="text-sm text-slate-500">
            Showing {filteredInventory.length} item(s) for selected site.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Item ID</th>
                <th className="px-4 py-3">Part Number</th>
                <th className="px-4 py-3">Description</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Site</th>
                <th className="px-4 py-3">Bin</th>
                <th className="px-4 py-3">Qty On Hand</th>
                <th className="px-4 py-3">Reorder Point</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>

            <tbody>
              {filteredInventory.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-slate-500">
                    No inventory records found for {activeSite}.
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
                      <td className="px-4 py-3 text-slate-700">
                        {normalizeSite(item.site || item.location)}
                      </td>
                      <td className="px-4 py-3 text-slate-700">{item.bin_location || '-'}</td>
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
                      <td className="px-4 py-3 text-right">
                        <div className="erp-row-actions">
                          <PrintInventoryTagButton
                            item={item}
                            className="erp-action-secondary"
                            showMessage={false}
                          />
                          <PrintLocationLabelButton
                            location={normalizeSite(item.site || item.location)}
                            binLocation={item.bin_location}
                            className="erp-action-secondary"
                            showMessage={false}
                          />
                          <Link href={`/inventory/${item.item_id}`} className="erp-action-primary">
                            Open
                          </Link>
                          {canEdit ? (
                            <button
                              type="button"
                              onClick={() =>
                                handleArchiveInventoryItem(
                                  item.item_id,
                                  item.part_number || item.item_id
                                )
                              }
                              disabled={archivePendingItemId === item.item_id}
                              className="erp-action-danger"
                            >
                              {archivePendingItemId === item.item_id ? 'Archiving...' : 'Delete'}
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {quickAdjustItem ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="w-full max-w-lg rounded-md border border-slate-200 bg-white p-5 shadow-xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-3">
              <div>
                <h2 className="text-base font-semibold text-slate-900">Quick Adjust</h2>
                <p className="mt-1 text-sm text-slate-500">
                  {quickAdjustItem.part_number || quickAdjustItem.item_id} · Current qty{' '}
                  {quickAdjustItem.qty_on_hand ?? 0}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setQuickAdjustItem(null)}
                className="erp-action-secondary"
              >
                Close
              </button>
            </div>

            <div className="mt-4 grid gap-3">
              <label className="text-sm font-semibold text-slate-700">
                Adjustment Type
                <select
                  value={quickAdjustType}
                  onChange={(event) => setQuickAdjustType(event.target.value as QuickAdjustType)}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="add">Add</option>
                  <option value="remove">Remove</option>
                  <option value="set">Set absolute quantity</option>
                </select>
              </label>

              <label className="text-sm font-semibold text-slate-700">
                Quantity
                <input
                  type="number"
                  min={1}
                  value={quickAdjustQty}
                  onChange={(event) => setQuickAdjustQty(event.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
              </label>

              <label className="text-sm font-semibold text-slate-700">
                Reason
                <textarea
                  value={quickAdjustReason}
                  onChange={(event) => setQuickAdjustReason(event.target.value)}
                  className="mt-1 min-h-20 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  placeholder="Required: count correction, damage, cycle count, found stock"
                />
              </label>

              {quickAdjustMessage ? (
                <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                  {quickAdjustMessage}
                </div>
              ) : null}
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setQuickAdjustItem(null)}
                className="erp-action-secondary"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitQuickAdjust}
                disabled={quickAdjustPending}
                className="erp-action-primary"
              >
                {quickAdjustPending ? 'Adjusting...' : 'Confirm Adjust'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
