'use client';

import Link from 'next/link';
import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import * as XLSX from 'xlsx';
import { createInventoryItem } from '../inventory/actions';
import type { InventoryActionResult, InventoryFormInput } from '../inventory/types';

type Props = {
  initialMode: 'add' | 'adjust';
  returnTo: string;
  initialPartNumber: string;
  initialDescription: string;
};

type UploadRow = {
  part_number: string;
  description: string;
  qty: number;
  site: string;
  bin_location: string;
};

const SITE_OPTIONS = ['SEA991', 'WH/A13', 'SEA99', 'SEA129', 'SEA133', 'SEA143'];

const EMPTY_FORM: InventoryFormInput = {
  item_id: '',
  part_number: '',
  description: '',
  category: '',
  location: 'SEA991',
  site: 'SEA991',
  bin_location: '',
  qty_on_hand: null,
  reorder_point: null,
  is_supply: false,
};

function normalizeSite(value: string) {
  const clean = value.trim().toUpperCase();

  if (clean === 'WH') return 'WH/A13';
  if (clean === 'A13') return 'WH/A13';
  if (clean === 'WH/A13') return 'WH/A13';

  if (SITE_OPTIONS.includes(clean)) return clean;

  return 'SEA991';
}

function readCell(row: Record<string, unknown>, possibleNames: string[]) {
  const keys = Object.keys(row);

  const match = keys.find((key) => {
    const cleanKey = key.toLowerCase().replace(/[^a-z0-9]/g, '');
    return possibleNames.some((name) => cleanKey.includes(name));
  });

  if (!match) return '';

  return String(row[match] ?? '').trim();
}

export function InventoryAdjustClient({
  initialMode,
  returnTo,
  initialPartNumber,
  initialDescription,
}: Props) {
  const router = useRouter();
  const [mode, setMode] = useState<'add' | 'adjust' | 'upload'>(initialMode);
  const [message, setMessage] = useState<InventoryActionResult | null>(null);
  const [isPending, startTransition] = useTransition();

  const [uploadRows, setUploadRows] = useState<UploadRow[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadDefaultSite, setUploadDefaultSite] = useState('SEA991');

  const [form, setForm] = useState<InventoryFormInput>({
    ...EMPTY_FORM,
    part_number: initialPartNumber,
    description: initialDescription,
  });

  const returnHref = useMemo(() => {
    return returnTo?.trim() ? returnTo.trim() : '/inventory';
  }, [returnTo]);

  function updateField<K extends keyof InventoryFormInput>(
    key: K,
    value: InventoryFormInput[K]
  ) {
    setForm((prev) => {
      const next = { ...prev, [key]: value };

      if (key === 'site') {
        const normalized = normalizeSite(String(value ?? ''));
        next.site = normalized;
        next.location = normalized;
      }

      return next;
    });
  }

  function resetForm() {
    setForm({
      ...EMPTY_FORM,
      part_number: initialPartNumber,
      description: initialDescription,
    });
    setMessage(null);
  }

  async function handleFileUpload(file: File) {
    setMessage(null);

    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);

    const rows: UploadRow[] = json
      .map((row) => {
        const partNumber =
          readCell(row, ['pn', 'partnumber', 'part', 'itemnumber', 'item']) || '';

        const description = readCell(row, ['description', 'desc', 'itemdescription']);

        const qtyRaw = readCell(row, ['qty', 'quantity', 'count', 'onhand']);
        const qty = qtyRaw === '' ? 0 : Number(qtyRaw) || 0;

        const siteRaw = readCell(row, ['site', 'location', 'warehouse']);
        const binLocation = readCell(row, ['bin', 'binlocation', 'rack', 'shelf']);

        return {
          part_number: partNumber,
          description,
          qty,
          site: normalizeSite(siteRaw || uploadDefaultSite),
          bin_location: binLocation,
        };
      })
      .filter((row) => row.part_number);

    setUploadRows(rows);

    if (rows.length === 0) {
      setMessage({
        ok: false,
        message: 'No usable part numbers found. Make sure the file has a PN or Part Number column.',
      });
    } else {
      setMessage({
        ok: true,
        message: `Loaded ${rows.length} row(s). Review before committing.`,
      });
    }
  }

  async function submitBulkUpload() {
    if (uploadRows.length === 0) {
      setMessage({ ok: false, message: 'No upload rows to commit.' });
      return;
    }

    setUploading(true);
    setMessage(null);

    let saved = 0;
    const failures: string[] = [];

    for (const row of uploadRows) {
      const result = await createInventoryItem({
        ...EMPTY_FORM,
        item_id: row.part_number,
        part_number: row.part_number,
        description: row.description,
        location: row.site,
        site: row.site,
        bin_location: row.bin_location,
        qty_on_hand: row.qty,
      });

      if (result.ok) {
        saved += 1;
      } else {
        failures.push(`${row.part_number}: ${result.message}`);
      }
    }

    setUploading(false);
    setUploadRows([]);
    router.refresh();

    setMessage({
      ok: failures.length === 0,
      message:
        failures.length === 0
          ? `Bulk upload complete. ${saved} item(s) added.`
          : `Bulk upload saved ${saved} item(s). ${failures.length} failed.`,
      skipReasons: failures.slice(0, 5),
    });
  }

  function submitAddItem() {
    setMessage(null);

    startTransition(async () => {
      const result = await createInventoryItem({
        ...form,
        site: normalizeSite(form.site || form.location),
        location: normalizeSite(form.site || form.location),
      });

      setMessage(result);

      if (result.ok) {
        resetForm();
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="erp-panel p-2">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setMode('add')}
            className={`rounded-md px-4 py-2 text-sm font-semibold ${
              mode === 'add'
                ? 'bg-cyan-700 text-white'
                : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            Add New Item
          </button>

          <button
            type="button"
            onClick={() => setMode('adjust')}
            className={`rounded-md px-4 py-2 text-sm font-semibold ${
              mode === 'adjust'
                ? 'bg-cyan-700 text-white'
                : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            Quantity Adjustment
          </button>

          <button
            type="button"
            onClick={() => setMode('upload')}
            className={`rounded-md px-4 py-2 text-sm font-semibold ${
              mode === 'upload'
                ? 'bg-cyan-700 text-white'
                : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            Excel Upload
          </button>
        </div>
      </div>

      {message ? (
        <div
          className={`rounded-md border px-4 py-3 text-sm ${
            message.ok
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-rose-200 bg-rose-50 text-rose-800'
          }`}
        >
          <div className="font-medium">{message.message}</div>

          {message.skipReasons?.length ? (
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {message.skipReasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {mode === 'upload' ? (
        <div className="erp-panel p-5">
          <div className="mb-4">
            <h2 className="text-base font-semibold text-slate-900">Upload Excel Inventory</h2>
            <p className="mt-1 text-sm text-slate-500">
              Upload Excel/CSV files with PN or Part Number and optional Qty. Missing Qty imports as 0.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Default Site
              </label>
              <select
                value={uploadDefaultSite}
                onChange={(event) => setUploadDefaultSite(event.target.value)}
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
              >
                {SITE_OPTIONS.map((site) => (
                  <option key={site} value={site}>
                    {site}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Excel / CSV File
              </label>
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) handleFileUpload(file);
                }}
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
          </div>

          {uploadRows.length > 0 ? (
            <div className="mt-5">
              <div className="mb-2 text-sm font-semibold text-slate-800">
                Preview: {uploadRows.length} row(s)
              </div>

              <div className="max-h-80 overflow-auto rounded-md border border-slate-200">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-3 py-2">PN</th>
                      <th className="px-3 py-2">Description</th>
                      <th className="px-3 py-2">Qty</th>
                      <th className="px-3 py-2">Site</th>
                      <th className="px-3 py-2">Bin</th>
                    </tr>
                  </thead>
                  <tbody>
                    {uploadRows.slice(0, 100).map((row, index) => (
                      <tr key={`${row.part_number}-${index}`} className="border-t border-slate-100">
                        <td className="px-3 py-2 font-medium text-slate-900">{row.part_number}</td>
                        <td className="px-3 py-2 text-slate-700">{row.description || '-'}</td>
                        <td className="px-3 py-2 text-slate-700">{row.qty}</td>
                        <td className="px-3 py-2 text-slate-700">{row.site}</td>
                        <td className="px-3 py-2 text-slate-700">{row.bin_location || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  onClick={submitBulkUpload}
                  disabled={uploading}
                  className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:cursor-wait disabled:opacity-70"
                >
                  {uploading ? 'Uploading...' : 'Commit Upload'}
                </button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {mode === 'add' ? (
        <div className="erp-panel p-5">
          <div className="mb-4">
            <h2 className="text-base font-semibold text-slate-900">Add New Inventory Item</h2>
            <p className="mt-1 text-sm text-slate-500">
              Create a new inventory record with site and bin location.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
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
              <label className="mb-1 block text-sm font-medium text-slate-700">Site</label>
              <select
                value={form.site}
                onChange={(event) => updateField('site', event.target.value)}
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
              >
                {SITE_OPTIONS.map((site) => (
                  <option key={site} value={site}>
                    {site}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Bin Location</label>
              <input
                value={form.bin_location}
                onChange={(event) => updateField('bin_location', event.target.value)}
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                placeholder="Rack A / Shelf 2"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Starting Qty</label>
              <input
                type="number"
                min={0}
                value={form.qty_on_hand ?? ''}
                onChange={(event) =>
                  updateField(
                    'qty_on_hand',
                    event.target.value === '' ? null : Number(event.target.value)
                  )
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
                  updateField(
                    'reorder_point',
                    event.target.value === '' ? null : Number(event.target.value)
                  )
                }
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="mt-4 flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <input
                type="checkbox"
                checked={Boolean(form.is_supply)}
                onChange={(event) => updateField('is_supply', event.target.checked)}
              />
              Supply / Consumable
            </label>
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-500">
              Add the item here, then continue receiving if this item came in from the dock.
            </p>

            <div className="flex gap-2">
              <Link
                href={returnHref}
                className="rounded border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Back
              </Link>

              <button
                type="button"
                onClick={submitAddItem}
                disabled={isPending}
                className="erp-button"
              >
                {isPending ? 'Saving...' : 'Add Item'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {mode === 'adjust' ? (
        <div className="erp-panel p-5">
          <h2 className="text-base font-semibold text-slate-900">Quantity Adjustment</h2>
          <p className="mt-2 text-sm text-slate-500">
            Manual Add / Remove / Set Absolute Quantity is still reserved for the next transaction-safe adjustment workflow.
          </p>
          <p className="mt-2 text-sm text-slate-500">
            Existing inventory can still be adjusted through receiving and controlled transaction flows.
          </p>
        </div>
      ) : null}
    </div>
  );
}