'use client';

import Link from 'next/link';
import { useCallback, useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ImportReviewModal } from '@/components/import-review-modal';
import { ScanCameraButton } from '@/components/scan-camera-button';
import { parseExcelFile } from '@/lib/excel-parser';
import type { ImportPreview } from '@/lib/import-workflow/types';
import { parseCsvRows } from '@/lib/import-workflow/parsing';
import {
  createInventoryItem,
  importInventoryItems,
  previewInventoryImport,
  updateInventoryItem,
} from './actions';
import { parseInventoryRows } from './inventory-import';
import type {
  InventoryActionResult,
  InventoryFormInput,
  InventoryImportInput,
  InventoryRecord,
} from './types';

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

const EMPTY_FORM: InventoryFormInput = {
  item_id: '',
  part_number: '',
  description: '',
  category: '',
  location: '',
  qty_on_hand: null,
  reorder_point: null,
  is_supply: false,
};

const PREVIEW_COLUMNS = [
  {
    key: 'item_id',
    label: 'Item ID',
    render: (record: InventoryImportInput) => record.item_id || '-',
  },
  {
    key: 'part_number',
    label: 'Part Number',
    render: (record: InventoryImportInput) => record.part_number || '-',
  },
  {
    key: 'description',
    label: 'Description',
    render: (record: InventoryImportInput) => record.description || '-',
  },
  {
    key: 'category',
    label: 'Category',
    render: (record: InventoryImportInput) => record.category || '-',
  },
  {
    key: 'location',
    label: 'Location',
    render: (record: InventoryImportInput) => record.location || '-',
  },
  {
    key: 'qty_on_hand',
    label: 'Qty',
    render: (record: InventoryImportInput) => record.qty_on_hand ?? '-',
  },
  {
    key: 'reorder_point',
    label: 'Reorder',
    render: (record: InventoryImportInput) => record.reorder_point ?? '-',
  },
];

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

function toForm(item: InventoryRecord): InventoryFormInput {
  return {
    id: item.id,
    item_id: item.item_id,
    part_number: item.part_number ?? '',
    description: item.description,
    category: item.category ?? '',
    location: item.location ?? '',
    qty_on_hand: item.qty_on_hand ?? 0,
    reorder_point: item.reorder_point ?? 0,
    is_supply: false,
  };
}

export function InventoryClient({ inventory }: Props) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const formPanelRef = useRef<HTMLDivElement | null>(null);

  const [mode, setMode] = useState<'add' | 'edit' | 'upload'>('add');
  const [form, setForm] = useState<InventoryFormInput>(EMPTY_FORM);
  const [message, setMessage] = useState<InventoryActionResult | null>(null);
  const [pendingRows, setPendingRows] = useState<InventoryImportInput[]>([]);
  const [preview, setPreview] = useState<ImportPreview<InventoryImportInput> | null>(null);
  const [query, setQuery] = useState('');
  const [countItem, setCountItem] = useState<InventoryRecord | null>(null);
  const [countQty, setCountQty] = useState(0);
  const [countCaptures, setCountCaptures] = useState<CountCapture[]>([]);
  const [countMessage, setCountMessage] = useState('Scan an item, part number, bin, or location to start a count.');
  const [isPending, startTransition] = useTransition();

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

  function updateField<K extends keyof InventoryFormInput>(key: K, value: InventoryFormInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

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
        setCountMessage('No exact match yet. Review the search cards below.');
      }
    },
    [inventoryOnly]
  );

  function startAdd() {
    setMode('add');
    setForm(EMPTY_FORM);
    setMessage(null);
    setPreview(null);
    setPendingRows([]);
    requestAnimationFrame(() => {
      formPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  function startEdit(item: InventoryRecord) {
    setMode('edit');
    setForm(toForm(item));
    setMessage({
      ok: true,
      message: `Editing ${item.item_id}${item.part_number ? ` | ${item.part_number}` : ''}`,
    });
    setPreview(null);
    setPendingRows([]);

    requestAnimationFrame(() => {
      formPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  function submitForm() {
    setMessage(null);

    startTransition(async () => {
      const payload = { ...form, is_supply: false };
      const result = mode === 'edit' ? await updateInventoryItem(payload) : await createInventoryItem(payload);
      setMessage(result);

      if (result.ok) {
        setMode('add');
        setForm(EMPTY_FORM);
        router.refresh();
      }
    });
  }

  async function readFileRows(file: File) {
    const fileName = file.name.toLowerCase();

    if (fileName.endsWith('.xlsx')) {
      return parseExcelFile(file);
    }

    if (fileName.endsWith('.csv')) {
      return parseCsvRows(await file.text());
    }

    throw new Error('Upload a CSV or Excel (.xlsx) inventory file.');
  }

  async function handleUpload(file: File | undefined) {
    if (!file) return;

    setMode('upload');
    setMessage(null);
    setPreview(null);
    setPendingRows([]);

    try {
      const rawRows = await readFileRows(file);
      const rows = parseInventoryRows(rawRows).map((row) => ({
        ...row,
        is_supply: false,
      }));

      if (rows.length === 0) {
        setMessage({
          ok: false,
          message:
            'No inventory rows found. Check for headers like item_id, part_number, description, qty_on_hand, or reorder_point.',
        });
        return;
      }

      startTransition(async () => {
        const result = await previewInventoryImport(rows);

        if (!result.ok || !result.preview) {
          setMessage({
            ok: false,
            message: result.message,
            skipReasons:
              result.preview?.skipReasons
                .map((reason) => `Row ${reason.rowNumber}: ${reason.reason}`)
                .slice(0, 5) ?? [],
          });
          return;
        }

        setPendingRows(rows);
        setPreview(result.preview);
        setMessage({ ok: true, message: result.message });
      });
    } catch (error) {
      setMessage({
        ok: false,
        message: error instanceof Error ? error.message : 'Failed to parse file. Check format.',
      });
    } finally {
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  function savePreview() {
    if (!preview || pendingRows.length === 0) return;

    startTransition(async () => {
      const result = await importInventoryItems(pendingRows.map((row) => ({ ...row, is_supply: false })));
      setMessage(result);
      setPreview(null);
      setPendingRows([]);

      if (result.ok) {
        router.refresh();
      }
    });
  }

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
    <>
      <div className="flex flex-col gap-4">
        <div className="erp-panel order-1 p-4 lg:order-2">
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
            <div className="flex gap-2">
              <ScanCameraButton onScan={handleInventoryScan} />
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

        <div className="erp-panel order-2 p-4 lg:order-3 lg:hidden">
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

        <div
          ref={formPanelRef}
          className={`erp-panel order-4 p-4 lg:order-1 ${mode === 'edit' ? 'border-cyan-300 shadow-sm shadow-cyan-100' : ''}`}
        >
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                {mode === 'edit'
                  ? 'Edit Inventory Item'
                  : mode === 'upload'
                    ? 'Upload Inventory'
                    : 'Add Inventory Item'}
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Add or update one item manually, or upload CSV/Excel rows for review before save.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={startAdd} className="erp-button">
                Add Item
              </button>
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                disabled={isPending}
                className="erp-button"
              >
                {isPending && mode === 'upload' ? 'Reading...' : 'Upload CSV / Excel'}
              </button>
              <input
                ref={inputRef}
                type="file"
                accept=".csv,text/csv,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                className="hidden"
                onChange={(event) => handleUpload(event.target.files?.[0])}
              />
            </div>
          </div>

          {mode === 'edit' ? (
            <div className="mt-4 rounded border border-cyan-200 bg-cyan-50 px-3 py-2 text-sm font-medium text-cyan-800">
              Editing item: {form.item_id || '(no item id)'}
            </div>
          ) : null}

          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Item ID</label>
              <input
                value={form.item_id}
                onChange={(event) => updateField('item_id', event.target.value)}
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                placeholder="INV-1001"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Part Number</label>
              <input
                value={form.part_number}
                onChange={(event) => updateField('part_number', event.target.value)}
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                placeholder="131950-390"
              />
            </div>

            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium text-slate-700">Description</label>
              <input
                value={form.description}
                onChange={(event) => updateField('description', event.target.value)}
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                placeholder="Harness assembly"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Category</label>
              <input
                value={form.category}
                onChange={(event) => updateField('category', event.target.value)}
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                placeholder="Harness"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Location</label>
              <input
                value={form.location}
                onChange={(event) => updateField('location', event.target.value)}
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                placeholder="SEA991"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Qty On Hand</label>
              <input
                type="number"
                min={0}
                value={form.qty_on_hand ?? ''}
                onChange={(event) =>
                  updateField('qty_on_hand', event.target.value === '' ? null : Number(event.target.value))
                }
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Reorder Point</label>
              <input
                type="number"
                min={0}
                value={form.reorder_point ?? ''}
                onChange={(event) =>
                  updateField('reorder_point', event.target.value === '' ? null : Number(event.target.value))
                }
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            {message ? (
              <div className={`text-sm font-medium ${message.ok ? 'text-emerald-700' : 'text-rose-700'}`}>
                <p>{message.message}</p>
                {message.skipReasons?.length ? (
                  <ul className="mt-1 list-disc pl-5 text-xs">
                    {message.skipReasons.map((reason) => (
                      <li key={reason}>{reason}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : (
              <p className="text-sm text-slate-500">
                Usable rows need item ID, part number, or description. Category, location, and
                quantities can be completed later.
              </p>
            )}

            <div className="flex gap-2">
              {mode === 'edit' ? (
                <button
                  type="button"
                  onClick={startAdd}
                  className="rounded border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel Edit
                </button>
              ) : null}

              <button type="button" onClick={submitForm} disabled={isPending} className="erp-button">
                {isPending ? 'Saving...' : mode === 'edit' ? 'Save Changes' : 'Add Item'}
              </button>
            </div>
          </div>
        </div>

        <div className="order-3 space-y-3 lg:order-4 lg:hidden">
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
                      <Link href={`/inventory/${item.item_id}`} className="text-base font-semibold text-cyan-700 hover:underline">
                        {item.part_number || item.item_id}
                      </Link>
                      <p className="mt-1 text-sm text-slate-600">{item.description}</p>
                    </div>
                    <span className={`shrink-0 rounded-full border px-2 py-1 text-xs font-semibold ${statusTone(status)}`}>
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

        <div className="erp-panel order-5 hidden overflow-hidden lg:block">
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
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>

              <tbody>
                {filteredInventory.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-slate-500">
                      No inventory records found in Supabase.
                    </td>
                  </tr>
                ) : (
                  filteredInventory.map((item) => {
                    const qtyOnHand = item.qty_on_hand ?? 0;
                    const reorderPoint = item.reorder_point ?? 0;
                    const status = getStatus(qtyOnHand, reorderPoint);
                    const isEditing = mode === 'edit' && form.id === item.id;

                    return (
                      <tr
                        key={item.id}
                        className={`border-b border-slate-100 align-top ${
                          isEditing ? 'bg-cyan-50 ring-1 ring-inset ring-cyan-200' : ''
                        }`}
                      >
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
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => startEdit(item)}
                            className={`font-semibold ${
                              isEditing ? 'text-cyan-900' : 'text-cyan-700 hover:underline'
                            }`}
                          >
                            {isEditing ? 'Editing' : 'Edit'}
                          </button>
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

      {preview ? (
        <ImportReviewModal
          title="Review Inventory Import"
          description="Rows with item ID or part number can update existing inventory. Description-only rows are saved as new incomplete items."
          preview={preview}
          columns={PREVIEW_COLUMNS}
          isSaving={isPending}
          onCancel={() => {
            setPreview(null);
            setPendingRows([]);
          }}
          onConfirm={savePreview}
        />
      ) : null}
    </>
  );
}