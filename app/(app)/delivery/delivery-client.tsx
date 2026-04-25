'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import * as XLSX from 'xlsx';
import { DataTable } from '@/components/data-table';
import { DELIVERY_DRAFT_STORAGE_KEY } from '@/lib/ai/intake/draft-storage';
import type {
  BomHeader,
  DeliveryPageData,
  DeliveryView,
  HistoryRecord,
  ManifestHeader,
} from './types';

const DEFAULT_SITE = 'SEA991';

const DELIVERY_TABS: { view: DeliveryView; label: string; href: string }[] = [
  { view: 'bom', label: 'BOM / Release', href: '/delivery?view=bom' },
  { view: 'manifest', label: 'Manifest', href: '/delivery?view=manifest' },
  { view: 'pickups', label: 'Pickups', href: '/delivery?view=pickups' },
  { view: 'deliveries', label: 'Drop-Offs', href: '/delivery?view=deliveries' },
  { view: 'history', label: 'History', href: '/delivery?view=history' },
];

type MovementDirection = 'incoming' | 'outgoing';

type MovementDraft = {
  id: string;
  source: 'manual' | 'upload' | 'saved';
  title: string;
  direction: MovementDirection;
  date: string | null;
  time: string | null;
  shipmentTransferId: string | null;
  reference: string | null;
  company: string | null;
  location: string | null;
  fromLocation: string | null;
  toLocation: string | null;
  contact: string | null;
  items: string | null;
  notes: string | null;
  status: string | null;
  href?: string | null;
};

type ManualFormState = {
  title: string;
  date: string;
  time: string;
  shipmentTransferId: string;
  reference: string;
  company: string;
  fromLocation: string;
  toLocation: string;
  contact: string;
  items: string;
  notes: string;
};

type DeliveryDraftPayload = {
  direction?: 'pickup' | 'delivery' | 'incoming' | 'outgoing' | 'unknown';
  company_name?: string;
  pickup_location?: string;
  dropoff_location?: string;
  contact_name?: string;
  contact_phone?: string;
  contact_email?: string;
  requested_date?: string;
  requested_time?: string;
  shipment_transfer_id?: string;
  project_or_work_order?: string;
  items?: string;
  notes?: string;
};

const EMPTY_FORM: ManualFormState = {
  title: '',
  date: new Date().toISOString().slice(0, 10),
  time: '',
  shipmentTransferId: '',
  reference: '',
  company: '',
  fromLocation: '',
  toLocation: DEFAULT_SITE,
  contact: '',
  items: '',
  notes: '',
};

function formatDate(value: string | null) {
  if (!value) return '-';
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString();
}

function formatTime(value: string | null) {
  if (!value) return '-';
  return value.slice(0, 5);
}

function directionLabel(direction: string | null) {
  if (direction === 'incoming') return 'Pickup';
  if (direction === 'outgoing') return 'Drop-Off';
  return '-';
}

function directionBadgeClass(direction: string | null) {
  if (direction === 'incoming') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (direction === 'outgoing') return 'border-cyan-200 bg-cyan-50 text-cyan-700';
  return 'border-slate-200 bg-slate-50 text-slate-600';
}

function sortDateTime(date: string | null, time: string | null) {
  const value = `${date || '1970-01-01'}T${time || '00:00'}:00`;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function normalizeText(value: string | null | undefined) {
  return value?.trim() || '';
}

function toMovementDraft(manifest: ManifestHeader): MovementDraft {
  const direction: MovementDirection = manifest.direction === 'incoming' ? 'incoming' : 'outgoing';

  return {
    id: `saved-${manifest.id}`,
    source: 'saved',
    title: manifest.document_title || 'Material Movement',
    direction,
    date: manifest.manifest_date,
    time: manifest.manifest_time,
    shipmentTransferId: manifest.shipment_transfer_id || null,
    reference: manifest.reference_project_work_order || null,
    company: null,
    location: null,
    fromLocation: direction === 'outgoing' ? DEFAULT_SITE : null,
    toLocation: direction === 'incoming' ? DEFAULT_SITE : null,
    contact: null,
    items: null,
    notes: null,
    status: manifest.status || 'Draft',
    href: `/driver-manifest/${manifest.id}`,
  };
}

function normalizeCell(row: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const match = Object.keys(row).find(
      (candidate) => candidate.trim().toLowerCase() === key.trim().toLowerCase()
    );

    if (match) {
      const value = row[match];
      if (value === null || value === undefined) return '';
      return String(value).trim();
    }
  }

  return '';
}

function parseUploadRows(rows: Record<string, unknown>[], direction: MovementDirection): MovementDraft[] {
  return rows
    .map((row, index) => {
      const title =
        normalizeCell(row, ['title', 'document title', 'job title', 'stop title']) ||
        `${direction === 'incoming' ? 'Pickup' : 'Drop-Off'} ${index + 1}`;

      const date = normalizeCell(row, [
        'date',
        'manifest date',
        'scheduled date',
        'pickup date',
        'delivery date',
      ]);
      const time = normalizeCell(row, [
        'time',
        'manifest time',
        'scheduled time',
        'pickup time',
        'delivery time',
      ]);
      const shipmentTransferId = normalizeCell(row, [
        'shipment id',
        'transfer id',
        'shipment/transfer',
        'shipment transfer id',
      ]);
      const reference = normalizeCell(row, [
        'reference',
        'project',
        'project/work order',
        'work order',
        'job',
      ]);
      const company = normalizeCell(row, ['company', 'customer', 'vendor']);
      const fromLocation =
        normalizeCell(row, ['from', 'from location', 'pickup location', 'ship from']) ||
        (direction === 'outgoing' ? DEFAULT_SITE : '');
      const toLocation =
        normalizeCell(row, ['to', 'to location', 'dropoff location', 'drop off location', 'ship to']) ||
        (direction === 'incoming' ? DEFAULT_SITE : '');
      const location = direction === 'incoming' ? fromLocation : toLocation;
      const contact = normalizeCell(row, ['contact', 'contact name', 'recipient']);
      const items = normalizeCell(row, ['items', 'parts', 'materials', 'description']);
      const notes = normalizeCell(row, ['notes', 'comments', 'remarks']);
      const status = normalizeCell(row, ['status']) || 'Imported';

      return {
        id: `upload-${direction}-${index}-${Math.random().toString(36).slice(2, 10)}`,
        source: 'upload' as const,
        title,
        direction,
        date: date || null,
        time: time || null,
        shipmentTransferId: shipmentTransferId || null,
        reference: reference || null,
        company: company || null,
        location: location || null,
        fromLocation: fromLocation || null,
        toLocation: toLocation || null,
        contact: contact || null,
        items: items || null,
        notes: notes || null,
        status,
        href: null,
      };
    })
    .filter((row) => row.title || row.location || row.items || row.reference);
}

function SetupMessage({ message, title }: { message: string; title: string }) {
  if (!message) return null;

  return (
    <section className="erp-card border-rose-200 bg-rose-50 p-5">
      <h2 className="text-base font-semibold text-rose-800">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-rose-700">{message}</p>
    </section>
  );
}

function DeliveryTabs({ current }: { current: DeliveryView }) {
  return (
    <div className="erp-panel overflow-x-auto p-2">
      <nav className="flex min-w-max gap-2" aria-label="Delivery views">
        {DELIVERY_TABS.map((tab) => {
          const active = tab.view === current;

          return (
            <Link
              key={tab.view}
              href={tab.href}
              className={`rounded-md px-4 py-2 text-sm font-semibold transition ${
                active
                  ? 'bg-cyan-700 text-white shadow-sm'
                  : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

function StatStrip({
  bomCount,
  manifestCount,
  pickupCount,
  deliveryCount,
}: {
  bomCount: number;
  manifestCount: number;
  pickupCount: number;
  deliveryCount: number;
}) {
  const stats = [
    { label: 'BOM / Release', value: bomCount },
    { label: 'Manifest Rows', value: manifestCount },
    { label: 'Pickups', value: pickupCount },
    { label: 'Drop-Offs', value: deliveryCount },
  ];

  return (
    <div className="grid gap-3 md:grid-cols-4">
      {stats.map((stat) => (
        <div key={stat.label} className="erp-panel p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {stat.label}
          </div>
          <div className="mt-2 text-2xl font-semibold text-slate-900">{stat.value}</div>
        </div>
      ))}
    </div>
  );
}

function BomReleaseView({ boms, setupError }: { boms: BomHeader[]; setupError: string }) {
  if (setupError) {
    return <SetupMessage title="BOM storage is not ready" message={setupError} />;
  }

  if (boms.length === 0) {
    return (
      <section className="erp-card p-8 text-center">
        <h2 className="text-base font-semibold text-slate-800">No BOM releases yet</h2>
        <p className="mx-auto mt-2 max-w-xl text-sm text-slate-500">
          Create the first BOM / Release record for saved review and print.
        </p>
        <div className="mt-5">
          <Link
            href="/bom/new"
            className="rounded-md bg-cyan-700 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-800"
          >
            Create BOM / Release
          </Link>
        </div>
      </section>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Link
          href="/bom/new"
          className="rounded-md bg-cyan-700 px-3 py-2 text-sm font-semibold text-white hover:bg-cyan-800"
        >
          Create BOM / Release
        </Link>
      </div>

      <div className="hidden md:block">
        <DataTable>
          <thead>
            <tr>
              <th>BOM #</th>
              <th>Date</th>
              <th>Status</th>
              <th>Project / Job #</th>
              <th>Requested By</th>
            </tr>
          </thead>
          <tbody>
            {boms.map((bom) => (
              <tr key={bom.id}>
                <td>
                  <Link href={`/bom/${bom.id}`} className="font-semibold text-cyan-700 hover:underline">
                    {bom.bom_number || '(Auto-numbered)'}
                  </Link>
                </td>
                <td>{formatDate(bom.bom_date)}</td>
                <td>{bom.status || 'Saved'}</td>
                <td>{bom.project_job_number || '-'}</td>
                <td>{bom.requested_by || '-'}</td>
              </tr>
            ))}
          </tbody>
        </DataTable>
      </div>
    </div>
  );
}

function SectionToolbar({
  title,
  subtitle,
  addLabel,
  uploadLabel,
  onAdd,
  onUpload,
}: {
  title: string;
  subtitle: string;
  addLabel: string;
  uploadLabel: string;
  onAdd: () => void;
  onUpload: () => void;
}) {
  return (
    <div className="erp-panel flex flex-col gap-4 p-4 md:flex-row md:items-center md:justify-between">
      <div>
        <h2 className="text-base font-semibold text-slate-900">{title}</h2>
        <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onAdd}
          className="rounded-md bg-cyan-700 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-800"
        >
          {addLabel}
        </button>
        <button
          type="button"
          onClick={onUpload}
          className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          {uploadLabel}
        </button>
      </div>
    </div>
  );
}

function ManualEntryPanel({
  open,
  title,
  direction,
  form,
  onChange,
  onCancel,
  onSave,
}: {
  open: boolean;
  title: string;
  direction: MovementDirection;
  form: ManualFormState;
  onChange: (field: keyof ManualFormState, value: string) => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  if (!open) return null;

  return (
    <section className="erp-card border-cyan-200 p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-slate-900">{title}</h3>
          <p className="mt-1 text-sm text-slate-500">
            Add a {direction === 'incoming' ? 'pickup' : 'drop-off'} stop manually.
          </p>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          Cancel
        </button>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <label className="text-sm font-medium text-slate-700">
          Title
          <input
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            value={form.title}
            onChange={(event) => onChange('title', event.target.value)}
            placeholder={direction === 'incoming' ? 'Pickup stop title' : 'Drop-off stop title'}
          />
        </label>

        <label className="text-sm font-medium text-slate-700">
          Date
          <input
            type="date"
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            value={form.date}
            onChange={(event) => onChange('date', event.target.value)}
          />
        </label>

        <label className="text-sm font-medium text-slate-700">
          Time
          <input
            type="time"
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            value={form.time}
            onChange={(event) => onChange('time', event.target.value)}
          />
        </label>

        <label className="text-sm font-medium text-slate-700">
          Shipment / Transfer ID
          <input
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            value={form.shipmentTransferId}
            onChange={(event) => onChange('shipmentTransferId', event.target.value)}
            placeholder="Shipment or transfer ID"
          />
        </label>

        <label className="text-sm font-medium text-slate-700">
          Reference
          <input
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            value={form.reference}
            onChange={(event) => onChange('reference', event.target.value)}
            placeholder="Project, work order, or reference"
          />
        </label>

        <label className="text-sm font-medium text-slate-700">
          Company
          <input
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            value={form.company}
            onChange={(event) => onChange('company', event.target.value)}
            placeholder="Company / customer / vendor"
          />
        </label>

        <label className="text-sm font-medium text-slate-700">
          From
          <input
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            value={form.fromLocation}
            onChange={(event) => onChange('fromLocation', event.target.value)}
            placeholder={direction === 'incoming' ? 'Pickup from' : 'Ship from'}
          />
        </label>

        <label className="text-sm font-medium text-slate-700">
          To
          <input
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            value={form.toLocation}
            onChange={(event) => onChange('toLocation', event.target.value)}
            placeholder={`Default: ${DEFAULT_SITE}`}
          />
        </label>

        <label className="text-sm font-medium text-slate-700">
          Contact
          <input
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            value={form.contact}
            onChange={(event) => onChange('contact', event.target.value)}
            placeholder="Point of contact"
          />
        </label>

        <label className="text-sm font-medium text-slate-700">
          Items
          <input
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            value={form.items}
            onChange={(event) => onChange('items', event.target.value)}
            placeholder="Crates, parts, servers, etc."
          />
        </label>

        <label className="text-sm font-medium text-slate-700 md:col-span-2">
          Notes
          <textarea
            className="mt-1 min-h-[100px] w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            value={form.notes}
            onChange={(event) => onChange('notes', event.target.value)}
            placeholder="Driver notes, release notes, receiving notes, route notes"
          />
        </label>
      </div>

      <div className="mt-4 flex justify-end">
        <button
          type="button"
          onClick={onSave}
          className="rounded-md bg-cyan-700 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-800"
        >
          Save {direction === 'incoming' ? 'Pickup' : 'Drop-Off'}
        </button>
      </div>
    </section>
  );
}

function MovementTable({
  rows,
  emptyMessage,
}: {
  rows: MovementDraft[];
  emptyMessage: string;
}) {
  if (rows.length === 0) {
    return (
      <section className="erp-card p-8 text-center">
        <h2 className="text-base font-semibold text-slate-800">{emptyMessage}</h2>
        <p className="mx-auto mt-2 max-w-xl text-sm text-slate-500">
          Use the add button or upload a file to populate this section.
        </p>
      </section>
    );
  }

  return (
    <div className="hidden md:block">
      <DataTable>
        <thead>
          <tr>
            <th>Type</th>
            <th>Record</th>
            <th>Date</th>
            <th>Time</th>
            <th>From</th>
            <th>To</th>
            <th>Company</th>
            <th>Contact</th>
            <th>Items</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>
                <span
                  className={`rounded-md border px-2 py-1 text-xs font-semibold ${directionBadgeClass(
                    row.direction
                  )}`}
                >
                  {directionLabel(row.direction)}
                </span>
              </td>
              <td>
                {row.href ? (
                  <Link href={row.href} className="font-semibold text-cyan-700 hover:underline">
                    {row.title || '(Unnamed stop)'}
                  </Link>
                ) : (
                  <span className="font-semibold text-slate-900">{row.title || '(Unnamed stop)'}</span>
                )}
              </td>
              <td>{formatDate(row.date)}</td>
              <td>{formatTime(row.time)}</td>
              <td>{row.fromLocation || '-'}</td>
              <td>{row.toLocation || '-'}</td>
              <td>{row.company || '-'}</td>
              <td>{row.contact || '-'}</td>
              <td>{row.items || '-'}</td>
              <td>{row.status || '-'}</td>
            </tr>
          ))}
        </tbody>
      </DataTable>
    </div>
  );
}

function ManifestMovementTable({
  title,
  rows,
}: {
  title: string;
  rows: MovementDraft[];
}) {
  return (
    <div className="mt-5">
      <div className="rounded-md bg-slate-900 px-4 py-3 text-sm font-bold uppercase tracking-wide text-white">
        {title} ({rows.length})
      </div>

      {rows.length === 0 ? (
        <div className="border-x border-b border-slate-200 px-4 py-6 text-sm text-slate-500">
          No rows.
        </div>
      ) : (
        <div className="overflow-x-auto border-x border-b border-slate-200">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2">Time</th>
                <th className="px-3 py-2">From</th>
                <th className="px-3 py-2">To</th>
                <th className="px-3 py-2">Company</th>
                <th className="px-3 py-2">Contact</th>
                <th className="px-3 py-2">Items</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Notes</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-slate-100">
                  <td className="px-3 py-2">{formatTime(row.time)}</td>
                  <td className="px-3 py-2 font-semibold text-slate-800">{row.fromLocation || '-'}</td>
                  <td className="px-3 py-2 font-semibold text-slate-800">{row.toLocation || '-'}</td>
                  <td className="px-3 py-2">{row.company || '-'}</td>
                  <td className="px-3 py-2">{row.contact || '-'}</td>
                  <td className="px-3 py-2">{row.items || '-'}</td>
                  <td className="px-3 py-2">{row.status || '-'}</td>
                  <td className="px-3 py-2">{row.notes || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ManifestView({
  rows,
  selectedDate,
  onSelectedDateChange,
}: {
  rows: MovementDraft[];
  selectedDate: string;
  onSelectedDateChange: (value: string) => void;
}) {
  const dropoffs = rows
    .filter((row) => row.direction === 'outgoing')
    .sort((a, b) => sortDateTime(a.date, a.time) - sortDateTime(b.date, b.time));

  const pickups = rows
    .filter((row) => row.direction === 'incoming')
    .sort((a, b) => sortDateTime(a.date, a.time) - sortDateTime(b.date, b.time));

  return (
    <div className="space-y-4">
      <div className="erp-panel flex flex-col gap-4 p-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Daily Manifest</h2>
          <p className="text-sm text-slate-500">
            Shows pickup/drop-off counts, from/to locations, items, contacts, and notes.
          </p>
        </div>

        <div className="flex flex-wrap items-end gap-2">
          <label className="text-sm font-medium text-slate-700">
            Manifest Date
            <input
              type="date"
              value={selectedDate}
              onChange={(event) => onSelectedDateChange(event.target.value)}
              className="mt-1 block rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </label>

          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-md bg-cyan-700 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-800"
          >
            Print Manifest
          </button>
        </div>
      </div>

      <section className="erp-card p-6 print:shadow-none">
        <div className="border-b border-slate-200 pb-4">
          <h1 className="text-2xl font-bold text-slate-900">Driver Daily Manifest</h1>
          <p className="mt-1 text-sm text-slate-500">Date: {formatDate(selectedDate)}</p>

          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
              <div className="text-xs font-semibold uppercase text-slate-500">Total Stops</div>
              <div className="mt-1 text-2xl font-bold text-slate-900">{rows.length}</div>
            </div>
            <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3">
              <div className="text-xs font-semibold uppercase text-emerald-700">Pickups</div>
              <div className="mt-1 text-2xl font-bold text-emerald-800">{pickups.length}</div>
            </div>
            <div className="rounded-md border border-cyan-200 bg-cyan-50 p-3">
              <div className="text-xs font-semibold uppercase text-cyan-700">Drop-Offs</div>
              <div className="mt-1 text-2xl font-bold text-cyan-800">{dropoffs.length}</div>
            </div>
          </div>
        </div>

        <ManifestMovementTable title="Pickups" rows={pickups} />
        <ManifestMovementTable title="Drop-Offs" rows={dropoffs} />
      </section>
    </div>
  );
}

function HistoryView({
  records,
  movementRows,
  bomError,
  manifestError,
}: {
  records: HistoryRecord[];
  movementRows: MovementDraft[];
  bomError: string;
  manifestError: string;
}) {
  const sortedMovements = [...movementRows].sort(
    (a, b) => sortDateTime(b.date, b.time) - sortDateTime(a.date, a.time)
  );

  return (
    <div className="space-y-4">
      {bomError || manifestError ? (
        <div className="space-y-3">
          <SetupMessage title="BOM storage is not ready" message={bomError} />
          <SetupMessage title="Manifest storage is not ready" message={manifestError} />
        </div>
      ) : null}

      <section className="erp-panel p-4">
        <h2 className="text-base font-semibold text-slate-900">Movement History</h2>
        <p className="mt-1 text-sm text-slate-500">
          Daily pickup and drop-off activity, including saved manifests plus manual and uploaded working rows.
        </p>
      </section>

      {sortedMovements.length === 0 ? (
        <section className="erp-card p-8 text-center">
          <h2 className="text-base font-semibold text-slate-800">No movement history yet</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-slate-500">
            Pickup and drop-off activity will appear here once records are added or imported.
          </p>
        </section>
      ) : (
        <MovementTable rows={sortedMovements} emptyMessage="No movement history yet" />
      )}

      {records.length > 0 ? (
        <section className="erp-card p-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-600">
            Saved document history
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            BOM / Release and manifest documents currently stored in the system.
          </p>
        </section>
      ) : null}
    </div>
  );
}

export function DeliveryClient({
  view,
  boms,
  manifests,
  history,
  bomError,
  manifestError,
}: DeliveryPageData) {
  const [manualRows, setManualRows] = useState<MovementDraft[]>([]);
  const [showPickupForm, setShowPickupForm] = useState(false);
  const [showDeliveryForm, setShowDeliveryForm] = useState(false);
  const [pickupForm, setPickupForm] = useState<ManualFormState>(EMPTY_FORM);
  const [deliveryForm, setDeliveryForm] = useState<ManualFormState>({
    ...EMPTY_FORM,
    fromLocation: DEFAULT_SITE,
    toLocation: '',
  });
  const [uploadMessage, setUploadMessage] = useState('');
  const [selectedManifestDate, setSelectedManifestDate] = useState(
    new Date().toISOString().slice(0, 10)
  );

  useEffect(() => {
    try {
      const rawDraft = window.localStorage.getItem(DELIVERY_DRAFT_STORAGE_KEY);

      if (!rawDraft) return;

      const draft = JSON.parse(rawDraft) as DeliveryDraftPayload;
      const isDelivery = draft.direction === 'delivery' || draft.direction === 'outgoing';
      const fromLocation = isDelivery
        ? normalizeText(draft.pickup_location) || DEFAULT_SITE
        : normalizeText(draft.pickup_location);
      const toLocation = isDelivery
        ? normalizeText(draft.dropoff_location)
        : normalizeText(draft.dropoff_location) || DEFAULT_SITE;

      const newRow: MovementDraft = {
        id: `ai-delivery-${Date.now()}`,
        source: 'upload',
        title: draft.items || (isDelivery ? 'AI Intake Drop-Off' : 'AI Intake Pickup'),
        direction: isDelivery ? 'outgoing' : 'incoming',
        date: draft.requested_date || new Date().toISOString().slice(0, 10),
        time: draft.requested_time || null,
        shipmentTransferId: draft.shipment_transfer_id || null,
        reference: draft.project_or_work_order || null,
        company: draft.company_name || null,
        location: isDelivery ? toLocation || null : fromLocation || null,
        fromLocation: fromLocation || null,
        toLocation: toLocation || null,
        contact: draft.contact_name || draft.contact_email || null,
        items: draft.items || null,
        notes: draft.notes || 'Generated from AI Intake.',
        status: 'AI Draft',
        href: null,
      };

      setManualRows((current) => [newRow, ...current]);
      setUploadMessage('AI Intake draft added to the working manifest.');
      window.localStorage.removeItem(DELIVERY_DRAFT_STORAGE_KEY);
    } catch (error) {
      console.error('Failed to load AI delivery draft:', error);
      setUploadMessage('AI Intake draft could not be loaded.');
    }
  }, []);

  const savedRows = useMemo(() => manifests.map(toMovementDraft), [manifests]);
  const allRows = useMemo(
    () =>
      [...savedRows, ...manualRows].sort(
        (a, b) => sortDateTime(a.date, a.time) - sortDateTime(b.date, b.time)
      ),
    [savedRows, manualRows]
  );

  const pickupRows = useMemo(
    () => allRows.filter((row) => row.direction === 'incoming'),
    [allRows]
  );

  const dropoffRows = useMemo(
    () => allRows.filter((row) => row.direction === 'outgoing'),
    [allRows]
  );

  const manifestRows = useMemo(
    () =>
      allRows.filter((row) => {
        if (!selectedManifestDate) return true;
        return row.date === selectedManifestDate;
      }),
    [allRows, selectedManifestDate]
  );

  function updatePickupForm(field: keyof ManualFormState, value: string) {
    setPickupForm((current) => ({ ...current, [field]: value }));
  }

  function updateDeliveryForm(field: keyof ManualFormState, value: string) {
    setDeliveryForm((current) => ({ ...current, [field]: value }));
  }

  function buildManualRow(direction: MovementDirection, form: ManualFormState): MovementDraft {
    const fromLocation =
      normalizeText(form.fromLocation) || (direction === 'outgoing' ? DEFAULT_SITE : null);
    const toLocation =
      normalizeText(form.toLocation) || (direction === 'incoming' ? DEFAULT_SITE : null);

    return {
      id: `manual-${direction}-${Math.random().toString(36).slice(2, 10)}`,
      source: 'manual',
      title: form.title || (direction === 'incoming' ? 'Manual Pickup' : 'Manual Drop-Off'),
      direction,
      date: form.date || null,
      time: form.time || null,
      shipmentTransferId: form.shipmentTransferId || null,
      reference: form.reference || null,
      company: form.company || null,
      location: direction === 'incoming' ? fromLocation : toLocation,
      fromLocation,
      toLocation,
      contact: form.contact || null,
      items: form.items || null,
      notes: form.notes || null,
      status: 'Manual',
      href: null,
    };
  }

  function savePickup() {
    setManualRows((current) => [...current, buildManualRow('incoming', pickupForm)]);
    setShowPickupForm(false);
    setPickupForm(EMPTY_FORM);
    setUploadMessage('Pickup added to today’s working manifest.');
  }

  function saveDelivery() {
    setManualRows((current) => [...current, buildManualRow('outgoing', deliveryForm)]);
    setShowDeliveryForm(false);
    setDeliveryForm({
      ...EMPTY_FORM,
      fromLocation: DEFAULT_SITE,
      toLocation: '',
    });
    setUploadMessage('Drop-off added to today’s working manifest.');
  }

  return (
    <div className="space-y-4">
      <StatStrip
        bomCount={boms.length}
        manifestCount={manifestRows.length}
        pickupCount={pickupRows.length}
        deliveryCount={dropoffRows.length}
      />

      <DeliveryTabs current={view} />

      {uploadMessage ? (
        <div className="erp-panel border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm text-cyan-800">
          {uploadMessage}
        </div>
      ) : null}

      {view === 'bom' ? <BomReleaseView boms={boms} setupError={bomError} /> : null}

      {view === 'manifest' ? (
        <ManifestView
          rows={manifestRows}
          selectedDate={selectedManifestDate}
          onSelectedDateChange={setSelectedManifestDate}
        />
      ) : null}

      {view === 'pickups' ? (
        <div className="space-y-4">
          <SectionToolbar
            title="Pickups"
            subtitle="Manual pickup entry for daily route planning."
            addLabel="Add Pickup"
            uploadLabel="Upload"
            onAdd={() => setShowPickupForm((current) => !current)}
            onUpload={() => setUploadMessage('Use AI Document Intake for screenshots, PDFs, and emails.')}
          />

          <ManualEntryPanel
            open={showPickupForm}
            title="Add Pickup"
            direction="incoming"
            form={pickupForm}
            onChange={updatePickupForm}
            onCancel={() => setShowPickupForm(false)}
            onSave={savePickup}
          />

          <MovementTable rows={pickupRows} emptyMessage="No pickups yet" />
        </div>
      ) : null}

      {view === 'deliveries' ? (
        <div className="space-y-4">
          <SectionToolbar
            title="Drop-Offs"
            subtitle="Manual drop-off entry for daily route planning."
            addLabel="Add Drop-Off"
            uploadLabel="Upload"
            onAdd={() => setShowDeliveryForm((current) => !current)}
            onUpload={() => setUploadMessage('Use AI Document Intake for screenshots, PDFs, and emails.')}
          />

          <ManualEntryPanel
            open={showDeliveryForm}
            title="Add Drop-Off"
            direction="outgoing"
            form={deliveryForm}
            onChange={updateDeliveryForm}
            onCancel={() => setShowDeliveryForm(false)}
            onSave={saveDelivery}
          />

          <MovementTable rows={dropoffRows} emptyMessage="No drop-offs yet" />
        </div>
      ) : null}

      {view === 'history' ? (
        <HistoryView
          records={history}
          movementRows={allRows}
          bomError={bomError}
          manifestError={manifestError}
        />
      ) : null}
    </div>
  );
}