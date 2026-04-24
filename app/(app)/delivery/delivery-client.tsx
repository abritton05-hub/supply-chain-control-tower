'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import * as XLSX from 'xlsx';
import { DataTable } from '@/components/data-table';
import type {
  BomHeader,
  DeliveryPageData,
  DeliveryView,
  HistoryRecord,
  ManifestHeader,
} from './types';

const DELIVERY_TABS: { view: DeliveryView; label: string; href: string }[] = [
  { view: 'bom', label: 'BOM / Release', href: '/delivery?view=bom' },
  { view: 'manifest', label: 'Manifest', href: '/delivery?view=manifest' },
  { view: 'pickups', label: 'Pickups', href: '/delivery?view=pickups' },
  { view: 'deliveries', label: 'Deliveries', href: '/delivery?view=deliveries' },
  { view: 'history', label: 'History', href: '/delivery?view=history' },
];

type MovementDirection = 'incoming' | 'outgoing';

type MovementDraft = {
  id: string;
  source: 'manual' | 'upload' | 'saved';
  manifestNumber?: string | null;
  title: string;
  direction: MovementDirection;
  date: string | null;
  time: string | null;
  driverCarrier: string | null;
  shipmentTransferId: string | null;
  reference: string | null;
  company: string | null;
  location: string | null;
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
  driverCarrier: string;
  shipmentTransferId: string;
  reference: string;
  company: string;
  location: string;
  contact: string;
  items: string;
  notes: string;
};

const EMPTY_FORM: ManualFormState = {
  title: '',
  date: new Date().toISOString().slice(0, 10),
  time: '',
  driverCarrier: '',
  shipmentTransferId: '',
  reference: '',
  company: '',
  location: '',
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
  if (direction === 'outgoing') return 'Delivery';
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

function toMovementDraft(manifest: ManifestHeader): MovementDraft {
  return {
    id: `saved-${manifest.id}`,
    source: 'saved',
    manifestNumber: manifest.manifest_number || null,
    title: manifest.document_title || 'Material Manifest',
    direction: manifest.direction === 'incoming' ? 'incoming' : 'outgoing',
    date: manifest.manifest_date,
    time: manifest.manifest_time,
    driverCarrier: manifest.driver_carrier || null,
    shipmentTransferId: manifest.shipment_transfer_id || null,
    reference: manifest.reference_project_work_order || null,
    company: null,
    location: null,
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
        `${direction === 'incoming' ? 'Pickup' : 'Delivery'} ${index + 1}`;

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
      const driverCarrier = normalizeCell(row, [
        'driver',
        'driver/carrier',
        'carrier',
        'driver carrier',
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
      const location = normalizeCell(row, ['location', 'address', 'site', 'ship to', 'ship from']);
      const contact = normalizeCell(row, ['contact', 'contact name', 'recipient']);
      const items = normalizeCell(row, ['items', 'parts', 'materials', 'description']);
      const notes = normalizeCell(row, ['notes', 'comments', 'remarks']);
      const status = normalizeCell(row, ['status']) || 'Imported';

      return {
        id: `upload-${direction}-${index}-${Math.random().toString(36).slice(2, 10)}`,
        source: 'upload' as const,
        manifestNumber: null,
        title,
        direction,
        date: date || null,
        time: time || null,
        driverCarrier: driverCarrier || null,
        shipmentTransferId: shipmentTransferId || null,
        reference: reference || null,
        company: company || null,
        location: location || null,
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
    { label: 'Manifest', value: manifestCount },
    { label: 'Pickups', value: pickupCount },
    { label: 'Deliveries', value: deliveryCount },
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
            Add a {direction === 'incoming' ? 'pickup' : 'delivery'} stop manually.
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
            placeholder={direction === 'incoming' ? 'Pickup stop title' : 'Delivery stop title'}
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
          Driver / Carrier
          <input
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            value={form.driverCarrier}
            onChange={(event) => onChange('driverCarrier', event.target.value)}
            placeholder="Driver or carrier"
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
          Location
          <input
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            value={form.location}
            onChange={(event) => onChange('location', event.target.value)}
            placeholder="Address or stop location"
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
          Save {direction === 'incoming' ? 'Pickup' : 'Delivery'}
        </button>
      </div>
    </section>
  );
}

function UploadPanel({
  open,
  title,
  description,
  onFileChange,
  helper,
}: {
  open: boolean;
  title: string;
  description: string;
  onFileChange: (file: File) => void;
  helper: string;
}) {
  if (!open) return null;

  return (
    <section className="erp-card border-slate-200 p-5">
      <h3 className="text-base font-semibold text-slate-900">{title}</h3>
      <p className="mt-1 text-sm text-slate-500">{description}</p>

      <div className="mt-4">
        <label className="block text-sm font-medium text-slate-700">
          Upload file
          <input
            type="file"
            accept=".csv,.xlsx,.xls,.pdf,.png,.jpg,.jpeg,.webp,.eml,.msg"
            className="mt-2 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) onFileChange(file);
              event.currentTarget.value = '';
            }}
          />
        </label>
      </div>

      <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
        <div className="font-semibold text-slate-700">Accepted inputs</div>
        <div className="mt-1">{helper}</div>
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
            <th>Company</th>
            <th>Location</th>
            <th>Contact</th>
            <th>Items</th>
            <th>Driver / Carrier</th>
            <th>Reference</th>
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
                    {row.manifestNumber || row.title || '(Unnamed stop)'}
                  </Link>
                ) : (
                  <span className="font-semibold text-slate-900">
                    {row.manifestNumber || row.title || '(Unnamed stop)'}
                  </span>
                )}
              </td>
              <td>{formatDate(row.date)}</td>
              <td>{formatTime(row.time)}</td>
              <td>{row.company || '-'}</td>
              <td>{row.location || '-'}</td>
              <td>{row.contact || '-'}</td>
              <td>{row.items || '-'}</td>
              <td>{row.driverCarrier || '-'}</td>
              <td>{row.reference || row.shipmentTransferId || '-'}</td>
              <td>{row.status || '-'}</td>
            </tr>
          ))}
        </tbody>
      </DataTable>
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
  const deliveries = rows
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
            Deliveries print on the top half. Pickups print on the bottom half.
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
        </div>

        <div className="mt-6">
          <div className="rounded-md bg-cyan-50 px-4 py-3 text-sm font-bold uppercase tracking-wide text-cyan-800">
            Deliveries / Drop-Offs
          </div>
          <div className="border-x border-b border-slate-200 px-4 py-6 text-sm text-slate-500">
            {deliveries.length} delivery row(s)
          </div>
        </div>

        <div className="mt-8">
          <div className="rounded-md bg-emerald-50 px-4 py-3 text-sm font-bold uppercase tracking-wide text-emerald-800">
            Pickups
          </div>
          <div className="border-x border-b border-slate-200 px-4 py-6 text-sm text-slate-500">
            {pickups.length} pickup row(s)
          </div>
        </div>
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
          Daily pickup and delivery activity, including saved manifests plus manual and uploaded working rows.
        </p>
      </section>

      {sortedMovements.length === 0 ? (
        <section className="erp-card p-8 text-center">
          <h2 className="text-base font-semibold text-slate-800">No movement history yet</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-slate-500">
            Pickup and delivery activity will appear here once records are added or imported.
          </p>
        </section>
      ) : (
        <DataTable>
          <thead>
            <tr>
              <th>Date</th>
              <th>Time</th>
              <th>Type</th>
              <th>Status</th>
              <th>Company</th>
              <th>Location</th>
              <th>Contact</th>
              <th>Items</th>
              <th>Driver / Carrier</th>
              <th>Reference</th>
              <th>Source</th>
            </tr>
          </thead>
          <tbody>
            {sortedMovements.map((row) => (
              <tr key={row.id}>
                <td>{formatDate(row.date)}</td>
                <td>{formatTime(row.time)}</td>
                <td>{directionLabel(row.direction)}</td>
                <td>{row.status || '-'}</td>
                <td>{row.company || '-'}</td>
                <td>{row.location || '-'}</td>
                <td>{row.contact || '-'}</td>
                <td>{row.items || '-'}</td>
                <td>{row.driverCarrier || '-'}</td>
                <td>{row.reference || row.shipmentTransferId || '-'}</td>
                <td className="uppercase">{row.source}</td>
              </tr>
            ))}
          </tbody>
        </DataTable>
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
  const [showPickupUpload, setShowPickupUpload] = useState(false);
  const [showDeliveryUpload, setShowDeliveryUpload] = useState(false);
  const [pickupForm, setPickupForm] = useState<ManualFormState>(EMPTY_FORM);
  const [deliveryForm, setDeliveryForm] = useState<ManualFormState>(EMPTY_FORM);
  const [uploadMessage, setUploadMessage] = useState('');
  const [selectedManifestDate, setSelectedManifestDate] = useState(
    new Date().toISOString().slice(0, 10)
  );

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

  const deliveryRows = useMemo(
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
    return {
      id: `manual-${direction}-${Math.random().toString(36).slice(2, 10)}`,
      source: 'manual',
      manifestNumber: null,
      title: form.title || (direction === 'incoming' ? 'Manual Pickup' : 'Manual Delivery'),
      direction,
      date: form.date || null,
      time: form.time || null,
      driverCarrier: form.driverCarrier || null,
      shipmentTransferId: form.shipmentTransferId || null,
      reference: form.reference || null,
      company: form.company || null,
      location: form.location || null,
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
    setDeliveryForm(EMPTY_FORM);
    setUploadMessage('Delivery added to today’s working manifest.');
  }

  async function handleUpload(file: File, direction: MovementDirection) {
    try {
      const lowerName = file.name.toLowerCase();

      if (
        !lowerName.endsWith('.csv') &&
        !lowerName.endsWith('.xlsx') &&
        !lowerName.endsWith('.xls')
      ) {
        setUploadMessage(
          'Upload received. Email, screenshot, PDF, and image parsing will be handled by AI Intake next.'
        );
        return;
      }

      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];

      if (!firstSheetName) {
        setUploadMessage('The uploaded file did not contain any sheets.');
        return;
      }

      const worksheet = workbook.Sheets[firstSheetName];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, { defval: '' });
      const parsed = parseUploadRows(rows, direction);

      if (parsed.length === 0) {
        setUploadMessage('No usable rows were found. Check the column names and try again.');
        return;
      }

      setManualRows((current) => [...current, ...parsed]);
      setUploadMessage(
        `${parsed.length} ${direction === 'incoming' ? 'pickup' : 'delivery'} row(s) imported into the working manifest.`
      );
    } catch (error) {
      setUploadMessage(error instanceof Error ? error.message : 'The upload could not be read.');
    }
  }

  return (
    <div className="space-y-4">
      <StatStrip
        bomCount={boms.length}
        manifestCount={manifestRows.length}
        pickupCount={pickupRows.length}
        deliveryCount={deliveryRows.length}
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
            subtitle="Manual pickup entry plus uploaded files for daily route planning."
            addLabel="Add Pickup"
            uploadLabel="Upload"
            onAdd={() => {
              setShowPickupForm((current) => !current);
              setShowPickupUpload(false);
            }}
            onUpload={() => {
              setShowPickupUpload((current) => !current);
              setShowPickupForm(false);
            }}
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

          <UploadPanel
            open={showPickupUpload}
            title="Upload Pickups"
            description="Upload pickup details from a file. CSV and Excel import today; email, screenshots, PDFs, and image parsing will route through AI Intake next."
            helper="Today: CSV / Excel. Next: emails, screenshots, PDFs, packing slips, and images through AI Intake."
            onFileChange={(file) => handleUpload(file, 'incoming')}
          />

          <MovementTable rows={pickupRows} emptyMessage="No pickups yet" />
        </div>
      ) : null}

      {view === 'deliveries' ? (
        <div className="space-y-4">
          <SectionToolbar
            title="Deliveries"
            subtitle="Manual delivery entry plus uploaded files for daily route planning."
            addLabel="Add Delivery"
            uploadLabel="Upload"
            onAdd={() => {
              setShowDeliveryForm((current) => !current);
              setShowDeliveryUpload(false);
            }}
            onUpload={() => {
              setShowDeliveryUpload((current) => !current);
              setShowDeliveryForm(false);
            }}
          />

          <ManualEntryPanel
            open={showDeliveryForm}
            title="Add Delivery"
            direction="outgoing"
            form={deliveryForm}
            onChange={updateDeliveryForm}
            onCancel={() => setShowDeliveryForm(false)}
            onSave={saveDelivery}
          />

          <UploadPanel
            open={showDeliveryUpload}
            title="Upload Deliveries"
            description="Upload delivery details from a file. CSV and Excel import today; email, screenshots, PDFs, and image parsing will route through AI Intake next."
            helper="Today: CSV / Excel. Next: emails, screenshots, PDFs, packing slips, and images through AI Intake."
            onFileChange={(file) => handleUpload(file, 'outgoing')}
          />

          <MovementTable rows={deliveryRows} emptyMessage="No deliveries yet" />
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