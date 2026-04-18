'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createKit, importKits, updateKit } from './actions';
import {
  BLOCK_REASONS,
  KIT_STATUSES,
  type BlockReason,
  type KitActionResult,
  type KitFormInput,
  type KitRecord,
  type KitStatus,
} from './types';

type Props = {
  kits: KitRecord[];
};

const EMPTY_FORM: KitFormInput = {
  kit_number: '',
  kit_name: '',
  project_name: '',
  location: '',
  status: 'Not Started',
  block_reason: '',
  completed_date: '',
  delivery_requested: false,
  delivery_requested_date: '',
  delivery_scheduled_date: '',
  notes: '',
};

function buildEmptyForm(): KitFormInput {
  return { ...EMPTY_FORM };
}

function kitToForm(kit: KitRecord): KitFormInput {
  return {
    id: kit.id,
    kit_number: kit.kit_number,
    kit_name: kit.kit_name,
    project_name: kit.project_name ?? '',
    location: kit.location ?? '',
    status: kit.status,
    block_reason: kit.block_reason ?? '',
    completed_date: kit.completed_date ?? '',
    delivery_requested: kit.delivery_requested,
    delivery_requested_date: kit.delivery_requested_date ?? '',
    delivery_scheduled_date: kit.delivery_scheduled_date ?? '',
    notes: kit.notes ?? '',
  };
}

function statusTone(status: KitStatus) {
  if (status === 'Blocked') return 'bg-rose-50 text-rose-700 border-rose-200';
  if (status === 'Ready' || status === 'Completed') {
    return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  }
  if (status.includes('Delivery')) return 'bg-cyan-50 text-cyan-700 border-cyan-200';
  if (status === 'Delivered') return 'bg-slate-100 text-slate-700 border-slate-300';
  return 'bg-amber-50 text-amber-700 border-amber-200';
}

function formatDate(value: string | null) {
  if (!value) return '-';
  return new Date(`${value}T00:00:00`).toLocaleDateString();
}

function normalizeHeader(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, '_');
}

function parseCsvLine(line: string) {
  const cells: string[] = [];
  let current = '';
  let quoted = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"' && quoted && next === '"') {
      current += '"';
      i += 1;
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

function parseBoolean(value: string) {
  return ['true', 'yes', 'y', '1'].includes(value.trim().toLowerCase());
}

function coerceStatus(value: string): KitStatus {
  const match = KIT_STATUSES.find((status) => status.toLowerCase() === value.trim().toLowerCase());
  return match ?? 'Not Started';
}

function coerceBlockReason(value: string): BlockReason | '' {
  const match = BLOCK_REASONS.find((reason) => reason.toLowerCase() === value.trim().toLowerCase());
  return match ?? '';
}

function deliveryState(kit: KitRecord) {
  if (kit.status === 'Delivered') return 'Delivered';
  if (kit.delivery_scheduled_date || kit.status === 'Delivery Scheduled') return 'Scheduled';
  if (kit.delivery_requested || kit.status === 'Delivery Requested') return 'Requested';
  return 'Not Requested';
}

function parseKitsCsv(text: string): KitFormInput[] {
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
      ...EMPTY_FORM,
      kit_number: row.kit_number || row.kit_id || '',
      kit_name: row.kit_name || '',
      project_name: row.project_name || row.project_id || '',
      location: row.location || '',
      status: coerceStatus(row.status || ''),
      block_reason: coerceBlockReason(row.block_reason || ''),
      completed_date: row.completed_date || '',
      delivery_requested: parseBoolean(row.delivery_requested || ''),
      delivery_requested_date: row.delivery_requested_date || '',
      delivery_scheduled_date: row.delivery_scheduled_date || '',
      notes: row.notes || '',
    };
  });
}

export function KitTrackerClient({ kits }: Props) {
  const router = useRouter();
  const [mode, setMode] = useState<'add' | 'edit' | 'upload'>('add');
  const [form, setForm] = useState<KitFormInput>(buildEmptyForm);
  const [entryRows, setEntryRows] = useState<KitFormInput[]>([buildEmptyForm()]);
  const [message, setMessage] = useState<KitActionResult | null>(null);
  const [statusFilter, setStatusFilter] = useState<'ALL' | KitStatus>('ALL');
  const [locationFilter, setLocationFilter] = useState('ALL');
  const [isPending, startTransition] = useTransition();

  const locations = useMemo(
    () =>
      Array.from(new Set(kits.map((kit) => kit.location).filter(Boolean))).sort() as string[],
    [kits]
  );

  const filteredKits = useMemo(
    () =>
      kits
        .filter((kit) => statusFilter === 'ALL' || kit.status === statusFilter)
        .filter((kit) => locationFilter === 'ALL' || kit.location === locationFilter)
        .sort((a, b) => {
        const aDate = a.delivery_scheduled_date ?? a.completed_date ?? '';
        const bDate = b.delivery_scheduled_date ?? b.completed_date ?? '';
        return bDate.localeCompare(aDate);
      }),
    [kits, locationFilter, statusFilter]
  );

  function updateField<K extends keyof KitFormInput>(key: K, value: KitFormInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function startAdd() {
    setMode('add');
    setForm(buildEmptyForm());
    setMessage(null);
  }

  function startEdit(kit: KitRecord) {
    setMode('edit');
    setForm(kitToForm(kit));
    setMessage(null);
  }

  function submitForm() {
    setMessage(null);
    startTransition(async () => {
      const result = mode === 'edit' ? await updateKit(form) : await createKit(form);
      setMessage(result);
      if (result.ok) {
        setMode('add');
        setForm(buildEmptyForm());
        router.refresh();
      }
    });
  }

  function addEntryLine() {
    setMode('add');
    setEntryRows((prev) => [...prev, buildEmptyForm()]);
    setMessage(null);
  }

  function updateEntryRow<K extends keyof KitFormInput>(
    rowIndex: number,
    key: K,
    value: KitFormInput[K]
  ) {
    setEntryRows((prev) =>
      prev.map((row, index) => (index === rowIndex ? { ...row, [key]: value } : row))
    );
  }

  function removeEntryRow(rowIndex: number) {
    setEntryRows((prev) => {
      const next = prev.filter((_, index) => index !== rowIndex);
      return next.length > 0 ? next : [buildEmptyForm()];
    });
  }

  function saveEntryRows() {
    setMode('add');
    setMessage(null);

    startTransition(async () => {
      const result = await importKits(entryRows);
      setMessage(result);

      if (result.ok) {
        setEntryRows([buildEmptyForm()]);
        router.refresh();
      }
    });
  }

  async function handleUpload(file: File | undefined) {
    if (!file) return;

    setMode('upload');
    setMessage(null);

    const fileName = file.name.toLowerCase();

    if (fileName.endsWith('.xlsx')) {
      setMessage({
        ok: false,
        message:
          'Excel .xlsx import is not enabled yet because this project does not include an Excel parser dependency. Save the worksheet as CSV and upload that file.',
      });
      return;
    }

    if (!fileName.endsWith('.csv')) {
      setMessage({ ok: false, message: 'Upload a .csv file for Kit Tracker import.' });
      return;
    }

    const text = await file.text();
    const rows = parseKitsCsv(text);

    startTransition(async () => {
      const result = await importKits(rows);
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
              {mode === 'edit' ? 'Edit Kit' : mode === 'upload' ? 'Upload Kits' : 'Kit Entry'}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              CSV headers accepted: kit_number, kit_name, project_name, location, status,
              block_reason, completed_date, delivery_requested, delivery_requested_date,
              delivery_scheduled_date, notes.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={addEntryLine} className="erp-button">
              Add line
            </button>
            <label className="erp-button cursor-pointer">
              Upload CSV
              <input
                type="file"
                accept=".csv,text/csv,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                className="hidden"
                onChange={(event) => handleUpload(event.target.files?.[0])}
              />
            </label>
            {mode === 'edit' ? (
              <button type="button" onClick={startAdd} className="erp-button">
                Cancel Edit
              </button>
            ) : null}
          </div>
        </div>

        {mode === 'edit' ? (
          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Kit Number</label>
            <input
              value={form.kit_number}
              onChange={(event) => updateField('kit_number', event.target.value)}
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
              placeholder="KIT-0001"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Kit Name</label>
            <input
              value={form.kit_name}
              onChange={(event) => updateField('kit_name', event.target.value)}
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
              placeholder="PAA V6 Rack Kit"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Project</label>
            <input
              value={form.project_name}
              onChange={(event) => updateField('project_name', event.target.value)}
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
              placeholder="Project or job"
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
            <label className="mb-1 block text-sm font-medium text-slate-700">Status</label>
            <select
              value={form.status}
              onChange={(event) => updateField('status', event.target.value as KitStatus)}
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
            >
              {KIT_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Block Reason</label>
            <select
              value={form.block_reason}
              onChange={(event) =>
                updateField('block_reason', event.target.value as BlockReason | '')
              }
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">None</option>
              {BLOCK_REASONS.map((reason) => (
                <option key={reason} value={reason}>
                  {reason}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Completed Date</label>
            <input
              type="date"
              value={form.completed_date}
              onChange={(event) => updateField('completed_date', event.target.value)}
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Delivery Scheduled Date
            </label>
            <input
              type="date"
              value={form.delivery_scheduled_date}
              onChange={(event) => updateField('delivery_scheduled_date', event.target.value)}
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
            />
          </div>

          <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <input
              type="checkbox"
              checked={form.delivery_requested}
              onChange={(event) => updateField('delivery_requested', event.target.checked)}
              className="h-4 w-4 rounded border-slate-300"
            />
            Delivery Requested
          </label>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Delivery Requested Date
            </label>
            <input
              type="date"
              value={form.delivery_requested_date}
              onChange={(event) => updateField('delivery_requested_date', event.target.value)}
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
            />
          </div>

          <div className="md:col-span-2 xl:col-span-3">
            <label className="mb-1 block text-sm font-medium text-slate-700">Notes</label>
            <input
              value={form.notes}
              onChange={(event) => updateField('notes', event.target.value)}
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
              placeholder="Operational notes"
            />
          </div>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            <div className="overflow-x-auto">
              <table className="min-w-[1600px] text-sm">
                <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-3 py-2">Kit Number</th>
                    <th className="px-3 py-2">Kit Name</th>
                    <th className="px-3 py-2">Project</th>
                    <th className="px-3 py-2">Location</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Block Reason</th>
                    <th className="px-3 py-2">Completed</th>
                    <th className="px-3 py-2">Delivery Requested</th>
                    <th className="px-3 py-2">Requested Date</th>
                    <th className="px-3 py-2">Scheduled Date</th>
                    <th className="px-3 py-2">Notes</th>
                    <th className="px-3 py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {entryRows.map((row, rowIndex) => (
                    <tr key={rowIndex} className="border-b border-slate-100 align-top">
                      <td className="px-3 py-2">
                        <input
                          value={row.kit_number}
                          onChange={(event) =>
                            updateEntryRow(rowIndex, 'kit_number', event.target.value)
                          }
                          className="w-36 rounded border border-slate-300 px-2 py-1"
                          placeholder="KIT-0001"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          value={row.kit_name}
                          onChange={(event) =>
                            updateEntryRow(rowIndex, 'kit_name', event.target.value)
                          }
                          className="w-44 rounded border border-slate-300 px-2 py-1"
                          placeholder="Rack kit"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          value={row.project_name}
                          onChange={(event) =>
                            updateEntryRow(rowIndex, 'project_name', event.target.value)
                          }
                          className="w-40 rounded border border-slate-300 px-2 py-1"
                          placeholder="Project"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          value={row.location}
                          onChange={(event) =>
                            updateEntryRow(rowIndex, 'location', event.target.value)
                          }
                          className="w-32 rounded border border-slate-300 px-2 py-1"
                          placeholder="SEA991"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <select
                          value={row.status}
                          onChange={(event) =>
                            updateEntryRow(rowIndex, 'status', event.target.value as KitStatus)
                          }
                          className="w-44 rounded border border-slate-300 px-2 py-1"
                        >
                          {KIT_STATUSES.map((status) => (
                            <option key={status} value={status}>
                              {status}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-2">
                        <select
                          value={row.block_reason}
                          onChange={(event) =>
                            updateEntryRow(
                              rowIndex,
                              'block_reason',
                              event.target.value as BlockReason | ''
                            )
                          }
                          className="w-56 rounded border border-slate-300 px-2 py-1"
                        >
                          <option value="">None</option>
                          {BLOCK_REASONS.map((reason) => (
                            <option key={reason} value={reason}>
                              {reason}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="date"
                          value={row.completed_date}
                          onChange={(event) =>
                            updateEntryRow(rowIndex, 'completed_date', event.target.value)
                          }
                          className="w-36 rounded border border-slate-300 px-2 py-1"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          checked={row.delivery_requested}
                          onChange={(event) =>
                            updateEntryRow(rowIndex, 'delivery_requested', event.target.checked)
                          }
                          className="h-4 w-4 rounded border-slate-300"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="date"
                          value={row.delivery_requested_date}
                          onChange={(event) =>
                            updateEntryRow(rowIndex, 'delivery_requested_date', event.target.value)
                          }
                          className="w-36 rounded border border-slate-300 px-2 py-1"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="date"
                          value={row.delivery_scheduled_date}
                          onChange={(event) =>
                            updateEntryRow(rowIndex, 'delivery_scheduled_date', event.target.value)
                          }
                          className="w-36 rounded border border-slate-300 px-2 py-1"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          value={row.notes}
                          onChange={(event) =>
                            updateEntryRow(rowIndex, 'notes', event.target.value)
                          }
                          className="w-56 rounded border border-slate-300 px-2 py-1"
                          placeholder="Notes"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          onClick={() => removeEntryRow(rowIndex)}
                          className="font-semibold text-cyan-700 hover:underline"
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          {message ? (
            <div className={`text-sm font-medium ${message.ok ? 'text-emerald-700' : 'text-rose-700'}`}>
              <p>{message.message}</p>
              {message.ok && message.summary?.skipReasons.length ? (
                <ul className="mt-1 list-disc pl-5 text-xs">
                  {message.summary.skipReasons.slice(0, 5).map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-slate-500">
              Required fields: kit number, kit name, status. Blank entry rows are skipped.
            </p>
          )}

          {mode === 'edit' ? (
            <button type="button" onClick={submitForm} disabled={isPending} className="erp-button">
              {isPending ? 'Saving...' : 'Save Changes'}
            </button>
          ) : (
            <button type="button" onClick={saveEntryRows} disabled={isPending} className="erp-button">
              {isPending ? 'Saving...' : 'Save lines'}
            </button>
          )}
        </div>
      </div>

      <div className="erp-panel p-4">
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Status Filter</label>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as 'ALL' | KitStatus)}
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="ALL">All statuses</option>
              {KIT_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Location Filter</label>
            <select
              value={locationFilter}
              onChange={(event) => setLocationFilter(event.target.value)}
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="ALL">All locations</option>
              {locations.map((location) => (
                <option key={location} value={location}>
                  {location}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-end">
            <button
              type="button"
              onClick={() => {
                setStatusFilter('ALL');
                setLocationFilter('ALL');
              }}
              className="erp-button"
            >
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      <div className="erp-panel overflow-hidden">
        <div className="border-b border-slate-200 px-4 py-3">
          <div className="text-sm font-semibold text-slate-900">Operational Kit Queue</div>
          <div className="text-xs text-slate-500">
            Filtered view: {filteredKits.length} of {kits.length} kits.
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Kit Number</th>
                <th className="px-4 py-3">Kit Name</th>
                <th className="px-4 py-3">Project</th>
                <th className="px-4 py-3">Location</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Block Reason</th>
                <th className="px-4 py-3">Completed</th>
                <th className="px-4 py-3">Delivery Requested</th>
                <th className="px-4 py-3">Requested Date</th>
                <th className="px-4 py-3">Delivery Scheduled</th>
                <th className="px-4 py-3">Delivery State</th>
                <th className="px-4 py-3">Notes</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>

            <tbody>
              {filteredKits.length === 0 ? (
                <tr>
                  <td colSpan={13} className="px-4 py-8 text-center text-slate-500">
                    <div className="text-base font-semibold text-slate-700">No kits match this view.</div>
                    <div className="mt-1 text-sm">
                      Add a kit, upload a CSV, or clear filters to return to the full operational queue.
                    </div>
                  </td>
                </tr>
              ) : (
                filteredKits.map((kit) => (
                  <tr key={kit.id} className="border-b border-slate-100 align-top">
                    <td className="px-4 py-3 font-medium text-slate-900">{kit.kit_number}</td>
                    <td className="px-4 py-3 text-slate-700">{kit.kit_name}</td>
                    <td className="px-4 py-3 text-slate-700">{kit.project_name || '-'}</td>
                    <td className="px-4 py-3 text-slate-700">{kit.location || '-'}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full border px-2 py-1 text-xs font-semibold ${statusTone(
                          kit.status
                        )}`}
                      >
                        {kit.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{kit.block_reason || '-'}</td>
                    <td className="px-4 py-3 text-slate-700">{formatDate(kit.completed_date)}</td>
                    <td className="px-4 py-3 text-slate-700">
                      {kit.delivery_requested ? 'Yes' : 'No'}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {formatDate(kit.delivery_requested_date)}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {formatDate(kit.delivery_scheduled_date)}
                    </td>
                    <td className="px-4 py-3 text-slate-700">{deliveryState(kit)}</td>
                    <td className="max-w-[280px] px-4 py-3 text-slate-700">{kit.notes || '-'}</td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => startEdit(kit)}
                        className="font-semibold text-cyan-700 hover:underline"
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
