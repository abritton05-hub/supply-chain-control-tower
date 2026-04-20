'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { parseExcelFile } from '@/lib/excel-parser';
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

const DEFAULT_LOCATION_OPTIONS = ['SEA133', 'SEA99', 'SEA991', 'Machine Shop'] as const;
const CUSTOM_LOCATION_OPTION = '__CUSTOM_LOCATION__';
const STORAGE_KEY = 'scct-kit-tracker-custom-locations';
const STATUS_OPTIONS = KIT_STATUSES.filter((status) => status !== 'Delivery Requested');

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

type EntryUiState = {
  customLocationOpen: boolean;
};

function buildEmptyForm(): KitFormInput {
  return { ...EMPTY_FORM };
}

function buildEmptyEntryUi(): EntryUiState {
  return { customLocationOpen: false };
}

function clean(value: string | null | undefined) {
  return value?.trim() ?? '';
}

type ImportField = Exclude<keyof KitFormInput, 'id' | 'source_row_number'>;

const IMPORT_HEADER_ALIASES: Record<ImportField, string[]> = {
  kit_number: ['kit number', 'kit_number', 'kit no', 'kit id', 'rack', 'rack id'],
  kit_name: ['kit name', 'kit_name', 'description', 'rack name'],
  project_name: ['project', 'project name', 'project_name', 'build', 'build name'],
  location: ['location', 'site', 'warehouse'],
  status: ['status', 'state'],
  block_reason: ['block reason', 'blocker', 'block_reason'],
  completed_date: ['completed', 'completed date', 'complete date'],
  delivery_requested: ['delivery requested', 'delivery_requested', 'requested'],
  delivery_requested_date: ['requested date', 'delivery requested date'],
  delivery_scheduled_date: ['scheduled date', 'delivery scheduled date'],
  notes: ['notes', 'comments', 'remarks'],
};

const NORMALIZED_IMPORT_HEADERS = Object.entries(IMPORT_HEADER_ALIASES).flatMap(
  ([field, aliases]) =>
    aliases.map((alias) => ({
      field: field as ImportField,
      key: normalizeImportHeader(alias),
    }))
);

type HeaderMatch = {
  headerIndex: number;
  columnToField: Map<number, ImportField>;
};

function normalizeImportHeader(value: string) {
  return String(value).trim().toLowerCase().replace(/[^a-z0-9]/g, '');
}

function findImportField(value: string) {
  const key = normalizeImportHeader(value);
  return NORMALIZED_IMPORT_HEADERS.find((entry) => entry.key === key)?.field;
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
  const normalized = value.trim().toLowerCase();

  if (normalized === 'delivery requested') {
    return 'Not Started';
  }

  const match = KIT_STATUSES.find((status) => status.toLowerCase() === normalized);
  return match ?? 'Not Started';
}

function coerceBlockReason(value: string): BlockReason | '' {
  const match = BLOCK_REASONS.find((reason) => reason.toLowerCase() === value.trim().toLowerCase());
  return match ?? '';
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

function deliveryState(kit: KitRecord) {
  if (kit.status === 'Delivered') return 'Delivered';
  if (kit.delivery_scheduled_date || kit.status === 'Delivery Scheduled') return 'Scheduled';
  if (kit.delivery_requested || kit.status === 'Delivery Requested') return 'Requested';
  return 'Not Requested';
}

function kitToForm(kit: KitRecord): KitFormInput {
  const deliveryRequested = kit.delivery_requested || kit.status === 'Delivery Requested';

  return {
    id: kit.id,
    kit_number: kit.kit_number,
    kit_name: kit.kit_name,
    project_name: kit.project_name ?? '',
    location: kit.location ?? '',
    status: kit.status === 'Delivery Requested' ? 'Not Started' : kit.status,
    block_reason: kit.block_reason ?? '',
    completed_date: kit.completed_date ?? '',
    delivery_requested: deliveryRequested,
    delivery_requested_date: kit.delivery_requested_date ?? '',
    delivery_scheduled_date: kit.delivery_scheduled_date ?? '',
    notes: kit.notes ?? '',
  };
}

function isBlankCells(cells: string[]) {
  return cells.every((cell) => !clean(cell));
}

function getHeaderMatch(cells: string[], rowIndex: number): HeaderMatch | null {
  const columnToField = new Map<number, ImportField>();
  const fields = new Set<ImportField>();

  cells.forEach((cell, columnIndex) => {
    const field = findImportField(cell);
    if (!field || fields.has(field)) return;
    fields.add(field);
    columnToField.set(columnIndex, field);
  });

  const hasKitNumber = fields.has('kit_number');
  const isUsableHeader = hasKitNumber || fields.size >= 2;

  return isUsableHeader ? { headerIndex: rowIndex, columnToField } : null;
}

function findHeaderRow(rows: string[][]): HeaderMatch | null {
  let bestMatch: HeaderMatch | null = null;
  let bestScore = 0;

  rows.forEach((cells, rowIndex) => {
    if (isBlankCells(cells)) return;

    const match = getHeaderMatch(cells, rowIndex);
    if (!match) return;

    const hasKitNumber = Array.from(match.columnToField.values()).includes('kit_number');
    const score = match.columnToField.size + (hasKitNumber ? 3 : 0);

    if (score > bestScore) {
      bestMatch = match;
      bestScore = score;
    }
  });

  return bestMatch;
}

function mapCellsToKitInput(
  cells: string[],
  header: HeaderMatch,
  sourceRowNumber: number
): KitFormInput {
  const row = Array.from(header.columnToField.entries()).reduce<Record<ImportField, string>>(
    (acc, [columnIndex, field]) => {
      acc[field] = clean(cells[columnIndex] ?? '');
      return acc;
    },
    {
      kit_number: '',
      kit_name: '',
      project_name: '',
      location: '',
      status: '',
      block_reason: '',
      completed_date: '',
      delivery_requested: '',
      delivery_requested_date: '',
      delivery_scheduled_date: '',
      notes: '',
    }
  );

  const rawStatus = row.status || '';

  return {
    ...EMPTY_FORM,
    source_row_number: sourceRowNumber,
    kit_number: row.kit_number,
    kit_name: row.kit_name,
    project_name: row.project_name,
    location: row.location,
    status: coerceStatus(rawStatus),
    block_reason: coerceBlockReason(row.block_reason),
    completed_date: row.completed_date,
    delivery_requested:
      parseBoolean(row.delivery_requested) ||
      rawStatus.trim().toLowerCase() === 'delivery requested',
    delivery_requested_date: row.delivery_requested_date,
    delivery_scheduled_date: row.delivery_scheduled_date,
    notes: row.notes,
  };
}

function parseKitRows(rows: string[][]): KitFormInput[] {
  const header = findHeaderRow(rows);
  if (!header) return [];

  return rows
    .slice(header.headerIndex + 1)
    .map((cells, index) => mapCellsToKitInput(cells, header, header.headerIndex + index + 2));
}

function parseKitsCsv(text: string): KitFormInput[] {
  const rows = text.split(/\r?\n/).map((line) => parseCsvLine(line));
  return parseKitRows(rows);
}

function parseExcelRowsToKitInputs(rawRows: string[][]): KitFormInput[] {
  return parseKitRows(rawRows);
}

function readStoredLocations() {
  if (typeof window === 'undefined') return [];

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((value) => clean(String(value))).filter(Boolean);
  } catch {
    return [];
  }
}

function persistStoredLocations(locations: string[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(locations));
}

function LocationPicker({
  value,
  options,
  customOpen,
  onCustomOpenChange,
  onChange,
  label = 'Location',
}: {
  value: string;
  options: string[];
  customOpen: boolean;
  onCustomOpenChange: (open: boolean) => void;
  onChange: (value: string) => void;
  label?: string;
}) {
  const selectValue =
    customOpen || (value && !options.includes(value)) ? CUSTOM_LOCATION_OPTION : value;

  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-slate-700">{label}</label>
      <select
        value={selectValue}
        onChange={(event) => {
          const next = event.target.value;

          if (next === CUSTOM_LOCATION_OPTION) {
            onCustomOpenChange(true);
            onChange('');
            return;
          }

          onCustomOpenChange(false);
          onChange(next);
        }}
        className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
      >
        <option value="">Select location</option>
        {options.map((location) => (
          <option key={location} value={location}>
            {location}
          </option>
        ))}
        <option value={CUSTOM_LOCATION_OPTION}>Add New Location</option>
      </select>

      {selectValue === CUSTOM_LOCATION_OPTION ? (
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="mt-2 w-full rounded border border-slate-300 px-3 py-2 text-sm"
          placeholder="Enter new location"
        />
      ) : null}
    </div>
  );
}

function EntryCard({
  row,
  rowIndex,
  locationOptions,
  uiState,
  onUiStateChange,
  onUpdate,
  onRemove,
}: {
  row: KitFormInput;
  rowIndex: number;
  locationOptions: string[];
  uiState: EntryUiState;
  onUiStateChange: (next: EntryUiState) => void;
  onUpdate: <K extends keyof KitFormInput>(key: K, value: KitFormInput[K]) => void;
  onRemove: () => void;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="mb-4 flex items-center justify-between">
        <div className="text-sm font-semibold text-slate-900">Line {rowIndex + 1}</div>
        <button
          type="button"
          onClick={onRemove}
          className="text-sm font-semibold text-cyan-700 hover:underline"
        >
          Remove
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Kit Number</label>
          <input
            value={row.kit_number}
            onChange={(event) => onUpdate('kit_number', event.target.value)}
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
            placeholder="KIT-0001"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Kit Name</label>
          <input
            value={row.kit_name}
            onChange={(event) => onUpdate('kit_name', event.target.value)}
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
            placeholder="Rack kit"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Project</label>
          <input
            value={row.project_name}
            onChange={(event) => onUpdate('project_name', event.target.value)}
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
            placeholder="Project"
          />
        </div>

        <LocationPicker
          value={row.location}
          options={locationOptions}
          customOpen={uiState.customLocationOpen}
          onCustomOpenChange={(open) => onUiStateChange({ ...uiState, customLocationOpen: open })}
          onChange={(value) => onUpdate('location', value)}
        />

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Status</label>
          <select
            value={row.status}
            onChange={(event) => onUpdate('status', event.target.value as KitStatus)}
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
          >
            {STATUS_OPTIONS.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Block Reason</label>
          <select
            value={row.block_reason}
            onChange={(event) => onUpdate('block_reason', event.target.value as BlockReason | '')}
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
            disabled={row.status !== 'Blocked'}
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
          <label className="mb-1 block text-sm font-medium text-slate-700">Completed</label>
          <input
            type="date"
            value={row.completed_date}
            onChange={(event) => onUpdate('completed_date', event.target.value)}
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
          />
        </div>

        <div className="flex items-end">
          <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <input
              type="checkbox"
              checked={row.delivery_requested}
              onChange={(event) => onUpdate('delivery_requested', event.target.checked)}
              className="h-4 w-4 rounded border-slate-300"
            />
            Delivery Requested
          </label>
        </div>
      </div>

      {row.delivery_requested ? (
        <div className="mt-4 rounded-lg border border-cyan-200 bg-cyan-50 p-4">
          <div className="mb-3 text-sm font-semibold text-cyan-900">Delivery Dates</div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Requested Date</label>
              <input
                type="date"
                value={row.delivery_requested_date}
                onChange={(event) => onUpdate('delivery_requested_date', event.target.value)}
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Scheduled Date</label>
              <input
                type="date"
                value={row.delivery_scheduled_date}
                onChange={(event) => onUpdate('delivery_scheduled_date', event.target.value)}
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
          </div>
        </div>
      ) : null}

      <div className="mt-4">
        <label className="mb-1 block text-sm font-medium text-slate-700">Notes</label>
        <textarea
          value={row.notes}
          onChange={(event) => onUpdate('notes', event.target.value)}
          className="min-h-[84px] w-full rounded border border-slate-300 px-3 py-2 text-sm"
          placeholder="Operational notes"
        />
      </div>
    </div>
  );
}

export function KitTrackerClient({ kits }: Props) {
  const router = useRouter();
  const uploadInputRef = useRef<HTMLInputElement | null>(null);

  const [mode, setMode] = useState<'add' | 'upload'>('add');
  const [entryRows, setEntryRows] = useState<KitFormInput[]>([buildEmptyForm()]);
  const [entryUi, setEntryUi] = useState<EntryUiState[]>([buildEmptyEntryUi()]);
  const [message, setMessage] = useState<KitActionResult | null>(null);
  const [statusFilter, setStatusFilter] = useState<'ALL' | KitStatus>('ALL');
  const [locationFilter, setLocationFilter] = useState('ALL');
  const [isPending, startTransition] = useTransition();

  const [customLocations, setCustomLocations] = useState<string[]>([]);

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editForm, setEditForm] = useState<KitFormInput>(buildEmptyForm);
  const [editCustomLocationOpen, setEditCustomLocationOpen] = useState(false);

  useEffect(() => {
    setCustomLocations(readStoredLocations());
  }, []);

  const dynamicLocations = useMemo(
    () =>
      Array.from(
        new Set(
          kits
            .map((kit) => kit.location)
            .filter(Boolean)
            .map((location) => location as string)
        )
      ).sort(),
    [kits]
  );

  const locationOptions = useMemo(
    () =>
      Array.from(
        new Set(
          [...DEFAULT_LOCATION_OPTIONS, ...dynamicLocations, ...customLocations]
            .map(clean)
            .filter(Boolean)
        )
      ).sort(),
    [customLocations, dynamicLocations]
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

  function addCustomLocationIfNeeded(rawValue: string) {
    const value = clean(rawValue);
    if (!value) return;

    setCustomLocations((prev) => {
      if (prev.includes(value) || locationOptions.includes(value)) {
        return prev;
      }

      const next = [...prev, value].sort();
      persistStoredLocations(next);
      return next;
    });
  }

  function startAdd() {
    setMode('add');
    setEntryRows([buildEmptyForm()]);
    setEntryUi([buildEmptyEntryUi()]);
    setMessage(null);
  }

  function addEntryLine() {
    setEntryRows((prev) => [...prev, buildEmptyForm()]);
    setEntryUi((prev) => [...prev, buildEmptyEntryUi()]);
    setMessage({ ok: true, message: 'Added line.' });
  }

  function updateEntryRow<K extends keyof KitFormInput>(
    rowIndex: number,
    key: K,
    value: KitFormInput[K]
  ) {
    setEntryRows((prev) =>
      prev.map((row, index) => {
        if (index !== rowIndex) return row;

        const next = { ...row, [key]: value };

        if (key === 'delivery_requested' && !value) {
          next.delivery_requested_date = '';
          next.delivery_scheduled_date = '';
          if (next.status === 'Delivery Scheduled') {
            next.status = 'Ready';
          }
        }

        if (key === 'status' && value !== 'Blocked') {
          next.block_reason = '';
        }

        if (key === 'status' && value === 'Delivered') {
          next.delivery_requested = true;
        }

        return next;
      })
    );
  }

  function removeEntryRow(rowIndex: number) {
    setEntryRows((prev) => {
      const next = prev.filter((_, index) => index !== rowIndex);
      return next.length > 0 ? next : [buildEmptyForm()];
    });

    setEntryUi((prev) => {
      const next = prev.filter((_, index) => index !== rowIndex);
      return next.length > 0 ? next : [buildEmptyEntryUi()];
    });
  }

  function saveEntryRows() {
    setMode('add');
    setMessage(null);

    entryRows.forEach((row) => addCustomLocationIfNeeded(row.location));

    startTransition(async () => {
      const result = await importKits(entryRows);
      setMessage(result);

      if (result.ok) {
        setEntryRows([buildEmptyForm()]);
        setEntryUi([buildEmptyEntryUi()]);
        router.refresh();
      }
    });
  }

  function openUploadPicker() {
    uploadInputRef.current?.click();
  }

  function openEditModal(kit: KitRecord) {
    const nextForm = kitToForm(kit);
    setEditForm(nextForm);
    setEditCustomLocationOpen(
      Boolean(nextForm.location) && !locationOptions.includes(nextForm.location)
    );
    setIsEditModalOpen(true);
    setMessage(null);
  }

  function closeEditModal() {
    setIsEditModalOpen(false);
    setEditForm(buildEmptyForm());
    setEditCustomLocationOpen(false);
  }

  function updateEditField<K extends keyof KitFormInput>(key: K, value: KitFormInput[K]) {
    setEditForm((prev) => {
      const next = { ...prev, [key]: value };

      if (key === 'delivery_requested' && !value) {
        next.delivery_requested_date = '';
        next.delivery_scheduled_date = '';
        if (next.status === 'Delivery Scheduled') {
          next.status = 'Ready';
        }
      }

      if (key === 'status' && value !== 'Blocked') {
        next.block_reason = '';
      }

      if (key === 'status' && value === 'Delivered') {
        next.delivery_requested = true;
      }

      return next;
    });
  }

  function submitEditForm() {
    setMessage(null);
    addCustomLocationIfNeeded(editForm.location);

    startTransition(async () => {
      const result = await updateKit(editForm);
      setMessage(result);

      if (result.ok) {
        closeEditModal();
        router.refresh();
      }
    });
  }

  async function handleUpload(file: File | undefined) {
    if (!file) return;

    setMode('upload');
    setMessage(null);

    const fileName = file.name.toLowerCase();
    let rows: KitFormInput[] = [];

    try {
      if (fileName.endsWith('.xlsx')) {
        const raw = await parseExcelFile(file);
        rows = parseExcelRowsToKitInputs(raw);
      } else if (fileName.endsWith('.csv')) {
        const text = await file.text();
        rows = parseKitsCsv(text);
      } else {
        setMessage({ ok: false, message: 'Upload a CSV or Excel (.xlsx) file.' });
        return;
      }

      rows.forEach((row) => addCustomLocationIfNeeded(row.location));

      if (rows.length === 0) {
        setMessage({
          ok: false,
          message:
            'No usable kit rows found. Check that the file has a header row with Kit Number, Rack, Description, Project, Location, Status, or another supported column name.',
        });
        return;
      }

      startTransition(async () => {
        const result = await importKits(rows);
        setMessage(result);
        if (result.ok) {
          router.refresh();
        }
      });
    } catch (error) {
      setMessage({
        ok: false,
        message: error instanceof Error ? error.message : 'Failed to parse file. Check format.',
      });
    }
  }

  return (
    <>
      <div className="space-y-4">
        <div className="erp-panel p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                {mode === 'upload' ? 'Upload Kits' : 'Kit Entry'}
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                CSV or Excel headers accepted: kit_number, kit_name, project_name, location,
                status, block_reason, completed_date, delivery_requested,
                delivery_requested_date, delivery_scheduled_date, notes.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={addEntryLine} className="erp-button">
                Add line
              </button>

              <button type="button" onClick={openUploadPicker} className="erp-button">
                Upload CSV / Excel
              </button>

              <button type="button" onClick={startAdd} className="erp-button">
                Clear Entry
              </button>

              <input
                ref={uploadInputRef}
                type="file"
                accept=".csv,text/csv,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                className="hidden"
                onChange={(event) => handleUpload(event.target.files?.[0])}
              />
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
            <div className="font-medium text-slate-700">
              Entry rows: <span className="text-slate-900">{entryRows.length}</span>
            </div>
            <div className="text-slate-500">
              Add rows, then click <span className="font-medium text-slate-700">Save lines</span>.
            </div>
          </div>

          <div className="mt-4 space-y-4">
            {entryRows.map((row, rowIndex) => (
              <EntryCard
                key={rowIndex}
                row={row}
                rowIndex={rowIndex}
                locationOptions={locationOptions}
                uiState={entryUi[rowIndex] ?? buildEmptyEntryUi()}
                onUiStateChange={(next) =>
                  setEntryUi((prev) => prev.map((item, index) => (index === rowIndex ? next : item)))
                }
                onUpdate={(key, value) => updateEntryRow(rowIndex, key, value)}
                onRemove={() => removeEntryRow(rowIndex)}
              />
            ))}
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            {message ? (
              <div
                className={`text-sm font-medium ${
                  message.ok ? 'text-emerald-700' : 'text-rose-700'
                }`}
              >
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
                Required fields: kit number, kit name, status. Delivery dates stay hidden until
                the delivery box is checked.
              </p>
            )}

            <button
              type="button"
              onClick={saveEntryRows}
              disabled={isPending}
              className="erp-button"
            >
              {isPending ? 'Saving...' : 'Save lines'}
            </button>
          </div>
        </div>

        <div className="erp-panel p-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Status Filter
              </label>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as 'ALL' | KitStatus)}
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="ALL">All statuses</option>
                {STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Location Filter
              </label>
              <select
                value={locationFilter}
                onChange={(event) => setLocationFilter(event.target.value)}
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="ALL">All locations</option>
                {locationOptions.map((location) => (
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
                      <div className="text-base font-semibold text-slate-700">
                        No kits match this view.
                      </div>
                      <div className="mt-1 text-sm">
                        Add a kit, upload a CSV or Excel file, or clear filters to return to the
                        full queue.
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
                      <td className="px-4 py-3 text-slate-700">
                        {formatDate(kit.completed_date)}
                      </td>
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
                      <td className="max-w-[280px] px-4 py-3 text-slate-700">
                        {kit.notes || '-'}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => openEditModal(kit)}
                          className="font-semibold text-cyan-700 hover:underline"
                        >
                          Update
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

      {isEditModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
          <div className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Update Kit</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Editing is separate from new entry on purpose.
                </p>
              </div>

              <button
                type="button"
                onClick={closeEditModal}
                className="rounded border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Close
              </button>
            </div>

            <div className="grid gap-4 px-6 py-5 md:grid-cols-2 xl:grid-cols-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Kit Number
                </label>
                <input
                  value={editForm.kit_number}
                  onChange={(event) => updateEditField('kit_number', event.target.value)}
                  className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                  placeholder="KIT-0001"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Kit Name</label>
                <input
                  value={editForm.kit_name}
                  onChange={(event) => updateEditField('kit_name', event.target.value)}
                  className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                  placeholder="Rack kit"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Project</label>
                <input
                  value={editForm.project_name}
                  onChange={(event) => updateEditField('project_name', event.target.value)}
                  className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                  placeholder="Project"
                />
              </div>

              <LocationPicker
                value={editForm.location}
                options={locationOptions}
                customOpen={editCustomLocationOpen}
                onCustomOpenChange={setEditCustomLocationOpen}
                onChange={(value) => updateEditField('location', value)}
              />

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Status</label>
                <select
                  value={editForm.status}
                  onChange={(event) => updateEditField('status', event.target.value as KitStatus)}
                  className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                >
                  {STATUS_OPTIONS.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Block Reason
                </label>
                <select
                  value={editForm.block_reason}
                  onChange={(event) =>
                    updateEditField('block_reason', event.target.value as BlockReason | '')
                  }
                  className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                  disabled={editForm.status !== 'Blocked'}
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
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Completed
                </label>
                <input
                  type="date"
                  value={editForm.completed_date}
                  onChange={(event) => updateEditField('completed_date', event.target.value)}
                  className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                />
              </div>

              <div className="flex items-end">
                <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={editForm.delivery_requested}
                    onChange={(event) => updateEditField('delivery_requested', event.target.checked)}
                    className="h-4 w-4 rounded border-slate-300"
                  />
                  Delivery Requested
                </label>
              </div>

              {editForm.delivery_requested ? (
                <>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">
                      Requested Date
                    </label>
                    <input
                      type="date"
                      value={editForm.delivery_requested_date}
                      onChange={(event) =>
                        updateEditField('delivery_requested_date', event.target.value)
                      }
                      className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">
                      Scheduled Date
                    </label>
                    <input
                      type="date"
                      value={editForm.delivery_scheduled_date}
                      onChange={(event) =>
                        updateEditField('delivery_scheduled_date', event.target.value)
                      }
                      className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                    />
                  </div>
                </>
              ) : null}

              <div className="md:col-span-2 xl:col-span-4">
                <label className="mb-1 block text-sm font-medium text-slate-700">Notes</label>
                <textarea
                  value={editForm.notes}
                  onChange={(event) => updateEditField('notes', event.target.value)}
                  className="min-h-[96px] w-full rounded border border-slate-300 px-3 py-2 text-sm"
                  placeholder="Operational notes"
                />
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-slate-200 px-6 py-4">
              <p className="text-sm text-slate-500">
                Update uses a popup so it feels different from adding new lines.
              </p>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={closeEditModal}
                  className="rounded border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={submitEditForm}
                  disabled={isPending}
                  className="erp-button"
                >
                  {isPending ? 'Saving...' : 'Update Kit'}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
