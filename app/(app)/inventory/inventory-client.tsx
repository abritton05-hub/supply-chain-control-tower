'use client';

import Link from 'next/link';
import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createInventoryItem, importInventoryItems, updateInventoryItem } from './actions';
import type { InventoryActionResult, InventoryFormInput, InventoryRecord } from './types';

type Props = {
  inventory: InventoryRecord[];
};

const EMPTY_FORM: InventoryFormInput = {
  item_id: '',
  part_number: '',
  description: '',
  category: '',
  location: '',
  qty_on_hand: 0,
  reorder_point: 0,
};

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
  };
}

function parseCsvLine(line: string) {
  const cells: string[] = [];
  let current = '';
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"' && quoted && next === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === ',' && !quoted) {
      cells.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  cells.push(current.trim());
  return cells;
}

function normalizeHeader(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, '_');
}

function parseNumber(value: string) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function parseInventoryCsv(text: string): InventoryFormInput[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) return [];

  const headers = parseCsvLine(lines[0]).map(normalizeHeader);

  return lines.slice(1).map((line) => {
    const cells = parseCsvLine(line);
    const row = headers.reduce<Record<string, string>>((acc, header, index) => {
      acc[header] = cells[index] ?? '';
      return acc;
    }, {});

    return {
      item_id: row.item_id || '',
      part_number: row.part_number || '',
      description: row.description || '',
      category: row.category || '',
      location: row.location || '',
      qty_on_hand: parseNumber(row.qty_on_hand || ''),
      reorder_point: parseNumber(row.reorder_point || ''),
    };
  });
}

export function InventoryClient({ inventory }: Props) {
  const router = useRouter();
  const [mode, setMode] = useState<'add' | 'edit' | 'upload'>('add');
  const [form, setForm] = useState<InventoryFormInput>(EMPTY_FORM);
  const [message, setMessage] = useState<InventoryActionResult | null>(null);
  const [query, setQuery] = useState('');
  const [isPending, startTransition] = useTransition();

  const filteredInventory = useMemo(() => {
    const value = query.trim().toLowerCase();
    if (!value) return inventory;

    return inventory.filter((item) =>
      `${item.item_id} ${item.part_number ?? ''} ${item.description} ${item.category ?? ''} ${
        item.location ?? ''
      }`
        .toLowerCase()
        .includes(value)
    );
  }, [inventory, query]);

  function updateField<K extends keyof InventoryFormInput>(key: K, value: InventoryFormInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function startAdd() {
    setMode('add');
    setForm(EMPTY_FORM);
    setMessage(null);
  }

  function startEdit(item: InventoryRecord) {
    setMode('edit');
    setForm(toForm(item));
    setMessage(null);
  }

  function submitForm() {
    setMessage(null);

    startTransition(async () => {
      const result = mode === 'edit' ? await updateInventoryItem(form) : await createInventoryItem(form);
      setMessage(result);

      if (result.ok) {
        setMode('add');
        setForm(EMPTY_FORM);
        router.refresh();
      }
    });
  }

  async function handleUpload(file: File | undefined) {
    if (!file) return;

    setMode('upload');
    setMessage(null);
    const text = await file.text();
    const rows = parseInventoryCsv(text);

    startTransition(async () => {
      const result = await importInventoryItems(rows);
      setMessage(result);

      if (result.ok) {
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="erp-panel p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              {mode === 'edit' ? 'Edit Inventory Item' : mode === 'upload' ? 'Upload Inventory' : 'Add Inventory Item'}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              CSV headers accepted: item_id, part_number, description, category, location,
              qty_on_hand, reorder_point.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={startAdd} className="erp-button">
              Add Item
            </button>
            <label className="erp-button cursor-pointer">
              Upload CSV
              <input
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(event) => handleUpload(event.target.files?.[0])}
              />
            </label>
          </div>
        </div>

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
              value={form.qty_on_hand}
              onChange={(event) => updateField('qty_on_hand', Number(event.target.value))}
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Reorder Point</label>
            <input
              type="number"
              min={0}
              value={form.reorder_point}
              onChange={(event) => updateField('reorder_point', Number(event.target.value))}
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          {message ? (
            <p className={`text-sm font-medium ${message.ok ? 'text-emerald-700' : 'text-rose-700'}`}>
              {message.message}
            </p>
          ) : (
            <p className="text-sm text-slate-500">
              Required fields: item ID, part number, description, category, location, quantities.
            </p>
          )}

          <button type="button" onClick={submitForm} disabled={isPending} className="erp-button">
            {isPending ? 'Saving...' : mode === 'edit' ? 'Save Changes' : 'Add Item'}
          </button>
        </div>
      </div>

      <div className="erp-panel p-4">
        <label className="mb-1 block text-sm font-medium text-slate-700">Search Inventory</label>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
          placeholder="Search item ID, part number, description, category, or location"
        />
      </div>

      <div className="erp-panel overflow-hidden">
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
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => startEdit(item)}
                          className="font-semibold text-cyan-700 hover:underline"
                        >
                          Edit
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
  );
}
