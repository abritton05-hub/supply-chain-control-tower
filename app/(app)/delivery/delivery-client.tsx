'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import type { DeliveryPageData } from './types';

const DEFAULT_SITE = 'SEA991';
const MANIFEST_START = 1501;
const BOM_START = 13501;
const DENALI_LOGO_SRC = '/denali-logo.png';

type Direction = 'incoming' | 'outgoing';

type ShippingLocation = {
  code: string;
  display_name: string;
  address: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  notes: string | null;
};

type StopRow = {
  id: string;
  manifestNumber: string;
  direction: Direction;
  title: string;
  date: string;
  time: string;
  shipmentTransferId: string;
  reference: string;
  fromLocation: string;
  fromAddress: string;
  toLocation: string;
  toAddress: string;
  contact: string;
  items: string;
  notes: string;
  status: string;
  createdAt: string;
};

type BomDraft = {
  bomNumber: string;
  manifestNumber: string;
  sourceStopId: string;
  createdAt: string;
  reference: string;
  shipFrom: string;
  shipTo: string;
  contact: string;
  items: string;
  notes: string;
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

function newId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function clean(value: string | null | undefined) {
  return value?.trim() || '';
}

function fixBadEncodingCharacters(text: string) {
  return text
    .replace(/\u00e2\u20ac\u201d/g, 'â€”')
    .replace(/\u00e2\u20ac\u201c/g, 'â€“')
    .replace(/\u00c3\u2014/g, 'Ã—')
    .replace(/\u00e2\u20ac\u2122/g, "'")
    .replace(/\u00e2\u20ac\u0153/g, '"')
    .replace(/\u00e2\u20ac\u009d/g, '"');
}

function normalizeLocation(value: string) {
  const normalized = value.trim().toUpperCase();
  if (normalized === 'WH' || normalized === 'A13' || normalized === 'WH/A13') return 'WH/A13';
  return normalized;
}

function formatType(direction: Direction) {
  return direction === 'incoming' ? 'Pickup' : 'Drop Off';
}

function parseManifestNumber(value: string) {
  const numeric = Number(value.replace('DAI-M-', '').replace('DAI-M', ''));
  return Number.isFinite(numeric) ? numeric : 0;
}

function createManifestNumber(existingManifestNumbers: string[]) {
  const used = existingManifestNumbers.map(parseManifestNumber).filter((value) => value > 0);
  const next = used.length ? Math.max(...used) + 1 : MANIFEST_START;
  return `DAI-M${next}`;
}

function createBomNumber(existingBomNumbers: string[]) {
  const used = existingBomNumbers
    .map((value) => Number(value.replace('DAI-B-', '').replace('DAI-B', '')))
    .filter((value) => Number.isFinite(value));
  const next = used.length ? Math.max(...used) + 1 : BOM_START;
  return `DAI-B${next}`;
}

function addressForLocation(locations: ShippingLocation[], code: string) {
  const normalized = normalizeLocation(code);
  return locations.find((location) => normalizeLocation(location.code) === normalized)?.address || '';
}

function contactForLocation(locations: ShippingLocation[], code: string) {
  const normalized = normalizeLocation(code);
  const location = locations.find((item) => normalizeLocation(item.code) === normalized);
  if (!location) return '';
  return [location.contact_name || '', location.contact_phone || ''].filter(Boolean).join(' | ');
}

function locationOptionLabel(location: ShippingLocation) {
  const code = normalizeLocation(location.code || '');
  const displayName = clean(location.display_name);
  return displayName ? `${code} â€” ${displayName}` : code;
}

function displayStopAddress(location: string, address: string) {
  const stopLocation = clean(location);
  const stopAddress = clean(address);
  if (!stopLocation && !stopAddress) return '-';
  if (!stopAddress) return stopLocation;
  if (!stopLocation) return stopAddress;
  return `${stopLocation}\n${stopAddress}`;
}

function manifestNumberForDate(date: string, rows: StopRow[]) {
  const existing = rows
    .filter((row) => row.date === date && row.manifestNumber)
    .sort((a, b) => {
      const manifestDelta =
        parseManifestNumber(a.manifestNumber) - parseManifestNumber(b.manifestNumber);
      if (manifestDelta !== 0) return manifestDelta;
      return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
    })[0]?.manifestNumber;

  return existing || createManifestNumber(rows.map((row) => row.manifestNumber).filter(Boolean));
}

function rowsForManifest(rows: StopRow[], manifestNumber: string, manifestDate: string) {
  if (!manifestNumber || !manifestDate) return [];
  return rows.filter((row) => row.manifestNumber === manifestNumber && row.date === manifestDate);
}

function emptyStop(
  direction: Direction,
  manifestNumber: string,
  stopDate: string,
  locations: ShippingLocation[]
): StopRow {
  const isPickup = direction === 'incoming';
  const fromLocation = isPickup ? '' : DEFAULT_SITE;
  const toLocation = isPickup ? DEFAULT_SITE : '';

  return {
    id: newId(isPickup ? 'pickup' : 'dropoff'),
    manifestNumber,
    direction,
    title: isPickup ? 'Pickup' : 'Drop Off',
    date: stopDate,
    time: '',
    shipmentTransferId: '',
    reference: '',
    fromLocation,
    fromAddress: fromLocation ? addressForLocation(locations, fromLocation) : '',
    toLocation,
    toAddress: toLocation ? addressForLocation(locations, toLocation) : '',
    contact: isPickup ? '' : contactForLocation(locations, toLocation),
    items: '',
    notes: '',
    status: 'Manual',
    createdAt: new Date().toISOString(),
  };
}

async function loadShippingLocations(): Promise<ShippingLocation[]> {
  const res = await fetch('/api/shipping/locations', { cache: 'no-store' });
  const data = await res.json();
  if (!data.ok) throw new Error(data.message || 'Failed to load shipping locations.');
  return data.locations || [];
}

async function loadManifestRows(): Promise<StopRow[]> {
  const res = await fetch('/api/shipping/manifest-history', { cache: 'no-store' });
  const data = await res.json();
  if (!data.ok) throw new Error(data.message || 'Failed to load manifest history.');

  return (data.rows || []).map((row: any) => ({
    id: row.id,
    manifestNumber: row.manifest_number || '',
    direction: row.direction,
    title: row.title || (row.direction === 'incoming' ? 'Pickup' : 'Drop Off'),
    date: row.stop_date || '',
    time: row.stop_time || '',
    shipmentTransferId: row.shipment_transfer_id || '',
    reference: fixBadEncodingCharacters(row.reference || ''),
    fromLocation: row.from_location || '',
    fromAddress: fixBadEncodingCharacters(row.from_address || ''),
    toLocation: row.to_location || '',
    toAddress: fixBadEncodingCharacters(row.to_address || ''),
    contact: fixBadEncodingCharacters(row.contact || ''),
    items: fixBadEncodingCharacters(row.items || ''),
    notes: fixBadEncodingCharacters(row.notes || ''),
    status: row.status || 'Draft',
    createdAt: row.created_at || '',
  }));
}

async function loadBomRows(): Promise<BomDraft[]> {
  const res = await fetch('/api/shipping/bom-history', { cache: 'no-store' });
  const data = await res.json();
  if (!data.ok) throw new Error(data.message || 'Failed to load BOM history.');

  return (data.rows || []).map((row: any) => ({
    bomNumber: row.bom_number || '',
    manifestNumber: row.manifest_number || '',
    sourceStopId: row.source_stop_id || '',
    createdAt: row.created_at || '',
    reference: fixBadEncodingCharacters(row.reference || ''),
    shipFrom: fixBadEncodingCharacters(row.ship_from || ''),
    shipTo: fixBadEncodingCharacters(row.ship_to || ''),
    contact: fixBadEncodingCharacters(row.contact || ''),
    items: fixBadEncodingCharacters(row.items || ''),
    notes: fixBadEncodingCharacters(row.notes || ''),
  }));
}

async function saveManifestRow(row: StopRow, method: 'POST' | 'PATCH') {
  const res = await fetch('/api/shipping/manifest-history', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: row.id,
      manifest_number: row.manifestNumber,
      direction: row.direction,
      title: row.title,
      stop_date: row.date || null,
      stop_time: row.time,
      shipment_transfer_id: row.shipmentTransferId,
      reference: row.reference,
      from_location: row.fromLocation,
      from_address: row.fromAddress,
      to_location: row.toLocation,
      to_address: row.toAddress,
      contact: row.direction === 'incoming' ? '' : row.contact,
      items: row.items,
      notes: row.notes,
      status: row.status,
    }),
  });

  const data = await res.json();
  if (!data.ok) throw new Error(data.message || 'Failed to save manifest stop.');
}

async function saveBomRow(bom: BomDraft) {
  const res = await fetch('/api/shipping/bom-history', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      bom_number: bom.bomNumber,
      manifest_number: bom.manifestNumber,
      source_stop_id: bom.sourceStopId,
      reference: bom.reference,
      ship_from: bom.shipFrom,
      ship_to: bom.shipTo,
      contact: bom.contact,
      items: bom.items,
      notes: bom.notes,
    }),
  });

  const data = await res.json();
  if (!data.ok) throw new Error(data.message || 'Failed to save BOM.');
}

function printElementById(id: string) {
  const element = document.getElementById(id);
  if (!element) return;

  const printWindow = window.open('', '_blank', 'width=1100,height=850');
  if (!printWindow) return;

  printWindow.document.write(`
    <html>
      <head>
        <title>Print</title>
        <style>
          * { box-sizing: border-box; }
          body { font-family: Arial, sans-serif; color: #0f172a; padding: 24px; }
          h1, h2, h3, p { margin: 0; }
          .document { max-width: 980px; margin: 0 auto; }
          .header { display: flex; align-items: flex-start; justify-content: space-between; gap: 24px; border-bottom: 3px solid #0f172a; padding-bottom: 14px; margin-bottom: 16px; }
          .logo { width: 190px; height: auto; object-fit: contain; }
          .title-block { text-align: right; }
          .title-block h1 { font-size: 26px; letter-spacing: 0.02em; }
          .title-block p { margin-top: 6px; font-size: 12px; }
          .meta { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-top: 14px; }
          .meta-cell { border: 1px solid #cbd5e1; padding: 8px; min-height: 48px; }
          .label { font-size: 10px; font-weight: 800; text-transform: uppercase; color: #475569; letter-spacing: 0.05em; }
          .value { margin-top: 4px; font-size: 12px; font-weight: 700; white-space: pre-wrap; }
          table { width: 100%; border-collapse: collapse; margin-top: 16px; }
          table th:nth-child(6), table td:nth-child(6) { width: 26%; }
          table th:nth-child(3), table td:nth-child(3), table th:nth-child(4), table td:nth-child(4) { width: 18%; }
          th, td { border: 1px solid #cbd5e1; padding: 8px; text-align: left; vertical-align: top; font-size: 11px; }
          th { background: #f1f5f9; text-transform: uppercase; font-size: 10px; letter-spacing: 0.04em; }
          pre { white-space: pre-wrap; font-family: Arial, sans-serif; font-size: 11px; margin: 0; }
          .box { border: 1px solid #cbd5e1; padding: 10px; margin-top: 12px; }
          .box-title { font-size: 11px; font-weight: 800; text-transform: uppercase; color: #475569; margin-bottom: 6px; }
          .signature-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; margin-top: 28px; }
          .signature-label { font-size: 12px; font-weight: 800; }
          .signature-line { border-bottom: 1px solid #0f172a; height: 32px; margin-top: 8px; }
          @media print { body { padding: 18px; } .document { max-width: none; } .logo { width: 175px; } }
        </style>
      </head>
      <body>${element.innerHTML}</body>
    </html>
  `);

  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
}

function StopModal({
  row,
  locations,
  onClose,
  onSave,
  onCreateBom,
}: {
  row: StopRow | null;
  locations: ShippingLocation[];
  onClose: () => void;
  onSave: (row: StopRow) => void;
  onCreateBom: (row: StopRow) => void;
}) {
  const [draft, setDraft] = useState<StopRow | null>(row);

  useEffect(() => {
    setDraft(row);
  }, [row]);

  if (!draft) return null;

  function update(field: keyof StopRow, value: string) {
    setDraft((current) => (current ? { ...current, [field]: value } : current));
  }

  function updateLocation(field: 'fromLocation' | 'toLocation', value: string) {
    const normalized = normalizeLocation(value);
    const address = addressForLocation(locations, normalized);
    const contact = contactForLocation(locations, normalized);

    setDraft((current) => {
      if (!current) return current;

      if (field === 'fromLocation') {
        return {
          ...current,
          fromLocation: normalized,
          fromAddress: address,
          contact: current.direction === 'incoming' ? '' : current.contact,
        };
      }

      return {
        ...current,
        toLocation: normalized,
        toAddress: address,
        contact: current.direction === 'incoming' ? '' : contact || current.contact,
      };
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 print:hidden">
      <div className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <h2 className="text-xl font-bold text-slate-950">
              {formatType(draft.direction)} Details
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Manifest {draft.manifestNumber}. Pick an address book code or type the address
              manually.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
          >
            Close
          </button>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <label className="text-sm font-semibold text-slate-700">
            Manifest #
            <input
              value={draft.manifestNumber}
              readOnly
              className="mt-1 h-11 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 text-sm text-slate-700"
            />
          </label>

          <TextInput label="Title" value={draft.title} onChange={(value) => update('title', value)} />
          <DateInput label="Date" value={draft.date} onChange={(value) => update('date', value)} />
          <TextInput label="Time / Window" value={draft.time} onChange={(value) => update('time', value)} />
          <TextInput
            label="PO / Shipment / Transfer ID"
            value={draft.shipmentTransferId}
            onChange={(value) => update('shipmentTransferId', value)}
          />
          <TextInput
            label="Reference / Project"
            value={draft.reference}
            onChange={(value) => update('reference', value)}
          />

          <LocationSelect
            label="From"
            value={draft.fromLocation}
            locations={locations}
            onChange={(value) => updateLocation('fromLocation', value)}
          />
          <LocationSelect
            label="To"
            value={draft.toLocation}
            locations={locations}
            onChange={(value) => updateLocation('toLocation', value)}
          />

          <TextArea
            label="From Address"
            value={draft.fromAddress}
            onChange={(value) => update('fromAddress', value)}
          />
          <TextArea
            label="To Address"
            value={draft.toAddress}
            onChange={(value) => update('toAddress', value)}
          />

          <div className="md:col-span-2">
            <TextInput
              label="Contact / POC"
              value={draft.contact}
              onChange={(value) => update('contact', value)}
            />
          </div>

          <div className="md:col-span-2">
            <div className="flex items-center justify-between gap-3">
              <label className="text-sm font-semibold text-slate-700">Items / PN / Qty</label>
              <button
                type="button"
                onClick={() => update('items', draft.items.trim() ? `${draft.items.trim()}\n1x ` : '1x ')}
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
              >
                Add Item Line
              </button>
            </div>
            <textarea
              value={draft.items}
              onChange={(event) => update('items', event.target.value)}
              className="mt-1 min-h-[150px] w-full rounded-xl border border-slate-300 bg-white px-3 py-2 font-mono text-sm text-slate-900"
              spellCheck={false}
            />
          </div>

          <div className="md:col-span-2">
            <TextArea label="Notes" value={draft.notes} onChange={(value) => update('notes', value)} />
          </div>
        </div>

        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={() => onSave(draft)}
            className="rounded-xl bg-cyan-700 px-4 py-2 text-sm font-bold text-white hover:bg-cyan-800"
          >
            Save Changes
          </button>

          {draft.direction === 'outgoing' ? (
            <button
              type="button"
              onClick={() => onCreateBom(draft)}
              className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-bold text-white hover:bg-slate-800"
            >
              Create BOM
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function TextInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="text-sm font-semibold text-slate-700">
      {label}
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900"
      />
    </label>
  );
}

function DateInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="text-sm font-semibold text-slate-700">
      {label}
      <input
        type="date"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900"
      />
    </label>
  );
}

function TextArea({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="text-sm font-semibold text-slate-700">
      {label}
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 min-h-[96px] w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
      />
    </label>
  );
}

function LocationSelect({
  label,
  value,
  locations,
  onChange,
}: {
  label: string;
  value: string;
  locations: ShippingLocation[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="text-sm font-semibold text-slate-700">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900"
      >
        <option value="">Manual / Select location</option>
        {locations.map((location) => (
          <option key={location.code} value={location.code}>
            {locationOptionLabel(location)}
          </option>
        ))}
      </select>
    </label>
  );
}

function PrintableBom({ bom }: { bom: BomDraft }) {
  return (
    <div id={`print-bom-${bom.bomNumber}`} className="hidden">
      <div className="document">
        <div className="header">
          {/* eslint-disable-next-line @next/next/no-img-element -- Plain img preserves print-only document output. */}
          <img src={DENALI_LOGO_SRC} alt="Denali Advanced Integration" className="logo" />
          <div className="title-block">
            <h1>BOM / Release</h1>
            <p>BOM #: {bom.bomNumber}</p>
            <p>Manifest #: {bom.manifestNumber}</p>
          </div>
        </div>

        <div className="meta">
          <MetaCell label="Created" value={bom.createdAt || '-'} />
          <MetaCell label="Reference" value={bom.reference || '-'} />
          <MetaCell label="Contact / POC" value={bom.contact || '-'} />
          <MetaCell label="Status" value="Release" />
        </div>

        <div className="meta">
          <MetaCell label="Ship From" value={bom.shipFrom || '-'} />
          <MetaCell label="Ship To" value={bom.shipTo || '-'} />
        </div>

        <table>
          <thead>
            <tr>
              <th>Line</th>
              <th>Item / PN / Qty</th>
            </tr>
          </thead>
          <tbody>
            {(bom.items || '')
              .split('\n')
              .filter(Boolean)
              .map((item, index) => (
                <tr key={`${bom.bomNumber}-${index}`}>                  <td>{item}</td>
                </tr>
              ))}
          </tbody>
        </table>

        <div className="box">
          <div className="box-title">Notes</div>
          <pre>{bom.notes || '-'}</pre>
        </div>

        <SignatureGrid />
      </div>
    </div>
  );
}

function PrintableManifest({
  manifestNumber,
  manifestDate,
  printId,
  rows,
}: {
  manifestNumber: string;
  manifestDate: string;
  printId: string;
  rows: StopRow[];
}) {
  return (
    <div id={printId} className="hidden">
      <div className="document">
        <div className="header">
          {/* eslint-disable-next-line @next/next/no-img-element -- Plain img preserves print-only document output. */}
          <img src={DENALI_LOGO_SRC} alt="Denali Advanced Integration" className="logo" />
          <div className="title-block">
            <h1>Route List</h1>
            <p>Manifest #: {manifestNumber}</p>
            <p>Date: {manifestDate || '-'}</p>
          </div>
        </div>

        <table>
          <thead>
            <tr>              <th>Type</th>
              <th>Date</th>
              <th>From</th>
              <th>To</th>
              <th>PO / Ref</th>
              <th>Items</th>
              <th>Contact</th>            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={`print-row-${row.id}`}>                <td>{formatType(row.direction)}</td>
                <td>{row.date || '-'}</td>
                <td>
                  <pre>{displayStopAddress(row.fromLocation, row.fromAddress)}</pre>
                </td>
                <td>
                  <pre>{displayStopAddress(row.toLocation, row.toAddress)}</pre>
                </td>
                <td>
                  {row.shipmentTransferId || '-'}
                  {row.reference ? (
                    <>
                      <br />
                      {row.reference}
                    </>
                  ) : null}
                </td>
                <td>
                  <pre>{row.items || '-'}</pre>
                </td>
                <td>{row.direction === 'incoming' ? '-' : row.contact || '-'}</td>              </tr>
            ))}
          </tbody>
        </table>

        <SignatureGrid />
      </div>
    </div>
  );
}

function MetaCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="meta-cell">
      <div className="label">{label}</div>
      <div className="value">{value}</div>
    </div>
  );
}

function SignatureGrid() {
  return (
    <div className="signature-grid">
      <div>
        <div className="signature-label">Driver / Authorized By</div>
        <div className="signature-line" />
      </div>
      <div>
        <div className="signature-label">Date / Time</div>
        <div className="signature-line" />
      </div>
      <div>
        <div className="signature-label">Released To</div>
        <div className="signature-line" />
      </div>
      <div>
        <div className="signature-label">Signature</div>
        <div className="signature-line" />
      </div>
    </div>
  );
}

function ManifestModal({
  manifestNumber,
  manifestDate,
  rows,
  onClose,
  onSave,
  onPrint,
  onEditStop,
}: {
  manifestNumber: string;
  manifestDate: string;
  rows: StopRow[];
  onClose: () => void;
  onSave: () => void;
  onPrint: () => void;
  onEditStop: (row: StopRow) => void;
}) {
  if (!manifestNumber || !manifestDate) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/50 p-4 print:hidden">
      <div className="max-h-[92vh] w-full max-w-7xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
        <div className="flex flex-col gap-4 border-b border-slate-200 pb-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-4">
            <Image
              src={DENALI_LOGO_SRC}
              alt="Denali Advanced Integration"
              width={176}
              height={64}
              className="h-auto w-44 object-contain"
              priority
            />
            <div>
              <h2 className="text-2xl font-bold text-slate-950">Manifest {manifestNumber}</h2>
              <p className="mt-1 text-sm text-slate-500">
                Review every stop for {manifestDate}. Open any stop to edit it.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
            aria-label="Close manifest"
          >
            Ã—
          </button>
        </div>

        <StopsTable rows={rows} mode="manifest" onOpen={onEditStop} />

        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={onSave}
            className="rounded-xl bg-cyan-700 px-4 py-2 text-sm font-bold text-white hover:bg-cyan-800"
          >
            Save Manifest
          </button>
          <button
            type="button"
            onClick={onPrint}
            disabled={!rows.length}
            className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-bold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Print Manifest
          </button>
        </div>

        <PrintableManifest
          manifestNumber={manifestNumber}
          manifestDate={manifestDate}
          printId={`print-manifest-modal-${manifestDate}-${manifestNumber}`}
          rows={rows}
        />
      </div>
    </div>
  );
}

function StopsTable({
  rows,
  mode,
  emptyText,
  onOpen,
}: {
  rows: StopRow[];
  mode: 'pickup' | 'dropoff' | 'manifest';
  emptyText?: string;
  onOpen: (row: StopRow) => void;
}) {
  const isManifest = mode === 'manifest';
  const primaryAddressLabel = isManifest || mode === 'pickup' ? 'From' : 'To';
  const secondaryAddressLabel = isManifest ? 'To' : '';

  return (
    <div className="mt-4 overflow-auto rounded-xl border border-slate-200">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50 text-left text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
          <tr>
            {isManifest ? <th className="px-3 py-3">Stop</th> : null}
            {isManifest ? <th className="px-3 py-3">Type</th> : null}
            <th className="px-3 py-3">Date</th>
            <th className="px-3 py-3">{primaryAddressLabel}</th>
            {isManifest ? <th className="px-3 py-3">{secondaryAddressLabel}</th> : null}
            <th className="px-3 py-3">PO / Ref</th>
            <th className="px-3 py-3">Items</th>
            {isManifest ? <th className="px-3 py-3">Contact</th> : null}
            {isManifest ? <th className="px-3 py-3">Status</th> : null}
            <th className="px-3 py-3 text-right">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 bg-white">
          {rows.length ? (
            rows.map((row, index) => {
              const primaryAddress =
                isManifest || mode === 'pickup'
                  ? displayStopAddress(row.fromLocation, row.fromAddress)
                  : displayStopAddress(row.toLocation, row.toAddress);
              const secondaryAddress =
                isManifest || mode === 'pickup'
                  ? displayStopAddress(row.toLocation, row.toAddress)
                  : displayStopAddress(row.fromLocation, row.fromAddress);

              return (
                <tr key={`${mode}-${row.id}`} className="align-top hover:bg-slate-50">
                  {isManifest ? (
                    <td className="px-3 py-3 font-bold text-slate-950">Stop {index + 1}</td>
                  ) : null}
                  {isManifest ? <td className="px-3 py-3">{formatType(row.direction)}</td> : null}
                  <td className="px-3 py-3">{row.date || '-'}</td>
                  <td className="whitespace-pre-line px-3 py-3">{primaryAddress}</td>
                  {isManifest ? (
                    <td className="whitespace-pre-line px-3 py-3">{secondaryAddress}</td>
                  ) : null}
                  <td className="px-3 py-3">
                    <div>{row.shipmentTransferId || '-'}</div>
                    <div className="text-xs text-slate-500">{row.reference || ''}</div>
                  </td>
                  <td className="whitespace-pre-line px-3 py-3">{row.items || '-'}</td>
                  {isManifest ? <td className="px-3 py-3">{row.contact || '-'}</td> : null}
                  {isManifest ? <td className="px-3 py-3">{row.status || '-'}</td> : null}
                  <td className="px-3 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => onOpen(row)}
                      className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
                    >
                      Open
                    </button>
                  </td>
                </tr>
              );
            })
          ) : (
            <tr>
              <td
                colSpan={isManifest ? 10 : 5}
                className="px-3 py-8 text-center text-sm text-slate-500"
              >
                {emptyText || 'No stops found.'}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export function DeliveryClient(_props: DeliveryPageData) {
  const [rows, setRows] = useState<StopRow[]>([]);
  const [locations, setLocations] = useState<ShippingLocation[]>([]);
  const [selectedRow, setSelectedRow] = useState<StopRow | null>(null);
  const [selectedManifestNumber, setSelectedManifestNumber] = useState('');
  const [selectedManifestDate, setSelectedManifestDate] = useState(today());
  const [bomDrafts, setBomDrafts] = useState<BomDraft[]>([]);
  const [message, setMessage] = useState('');
  const [loadingLabel, setLoadingLabel] = useState('');

  async function refreshData() {
    const [manifestRows, bomRows, shippingLocations] = await Promise.all([
      loadManifestRows(),
      loadBomRows(),
      loadShippingLocations(),
    ]);

    setRows(manifestRows);
    setBomDrafts(bomRows);
    setLocations(shippingLocations);
  }

  useEffect(() => {
    async function init() {
      try {
        setLoadingLabel('Loading shipping and delivery records...');
        await refreshData();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : 'Shipping data failed to load.');
      } finally {
        setLoadingLabel('');
      }
    }

    init();
  }, []);

  const selectedDateManifestNumber = manifestNumberForDate(selectedManifestDate, rows);
  const pickups = rows.filter(
    (row) => row.date === selectedManifestDate && row.direction === 'incoming'
  );
  const dropOffs = rows.filter(
    (row) => row.date === selectedManifestDate && row.direction === 'outgoing'
  );
  const selectedDateManifestRows = rowsForManifest(
    rows,
    selectedDateManifestNumber,
    selectedManifestDate
  );
  const selectedManifestRows = rowsForManifest(rows, selectedManifestNumber, selectedManifestDate);

  const groupedByDate = useMemo(() => {
    const dateGroups = new Map<string, Map<string, StopRow[]>>();

    for (const row of rows) {
      const date = row.date || 'Unassigned';
      const manifestNumber = row.manifestNumber || 'Unassigned';
      const manifests = dateGroups.get(date) || new Map<string, StopRow[]>();
      manifests.set(manifestNumber, [...(manifests.get(manifestNumber) || []), row]);
      dateGroups.set(date, manifests);
    }

    return Array.from(dateGroups.entries()).sort(
      (a, b) => new Date(b[0]).getTime() - new Date(a[0]).getTime()
    );
  }, [rows]);

  function changeManifestDate(value: string) {
    setSelectedManifestDate(value);
    setSelectedManifestNumber('');
    setSelectedRow(null);
  }

  async function addStop(direction: Direction) {
    try {
      const manifestNumber = manifestNumberForDate(selectedManifestDate, rows);
      const row = emptyStop(direction, manifestNumber, selectedManifestDate, locations);

      setLoadingLabel(`Creating ${formatType(direction)}...`);
      await saveManifestRow(row, 'POST');
      await refreshData();
      setSelectedRow(row);
      setMessage(`${formatType(direction)} added to manifest ${manifestNumber}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : `${formatType(direction)} save failed.`);
    } finally {
      setLoadingLabel('');
    }
  }

  async function handleSaveRow(row: StopRow) {
    try {
      const rowDate = row.date || selectedManifestDate || today();
      const manifestNumber = manifestNumberForDate(
        rowDate,
        rows.filter((existing) => existing.id !== row.id)
      );
      const rowToSave = { ...row, date: rowDate, manifestNumber };

      setLoadingLabel('Saving manifest stop...');
      await saveManifestRow(rowToSave, 'PATCH');
      await refreshData();
      setSelectedRow(null);
      setSelectedManifestDate(rowDate);
      setSelectedManifestNumber(manifestNumber);
      setMessage(`${formatType(row.direction)} saved.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Save failed.');
    } finally {
      setLoadingLabel('');
    }
  }

  async function handleCreateBom(row: StopRow) {
    try {
      const bomNumber = createBomNumber(bomDrafts.map((bom) => bom.bomNumber).filter(Boolean));
      const bom: BomDraft = {
        bomNumber,
        manifestNumber: row.manifestNumber,
        sourceStopId: row.id,
        createdAt: new Date().toISOString(),
        reference: row.reference || row.shipmentTransferId,
        shipFrom: displayStopAddress(row.fromLocation, row.fromAddress),
        shipTo: displayStopAddress(row.toLocation, row.toAddress),
        contact: row.direction === 'incoming' ? '' : row.contact,
        items: row.items,
        notes: row.notes,
      };

      setLoadingLabel('Creating BOM...');
      await saveBomRow(bom);
      await refreshData();
      setMessage(`BOM ${bomNumber} created.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'BOM creation failed.');
    } finally {
      setLoadingLabel('');
    }
  }

  function openManifest(manifestNumber: string, manifestDate: string) {
    setSelectedManifestDate(manifestDate);
    setSelectedManifestNumber(manifestNumber);
    setSelectedRow(null);
    setMessage(`Opened manifest ${manifestNumber}.`);
  }

  async function saveSelectedManifest() {
    if (!selectedManifestNumber) return;

    try {
      setLoadingLabel('Saving manifest...');
      await Promise.all(selectedManifestRows.map((row) => saveManifestRow(row, 'PATCH')));
      await refreshData();
      setMessage(`Manifest ${selectedManifestNumber} saved.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Manifest save failed.');
    } finally {
      setLoadingLabel('');
    }
  }

  return (
    <div className="space-y-4">
      {loadingLabel ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/40">
          <div className="rounded-2xl border border-slate-200 bg-white px-6 py-4 text-sm font-bold text-slate-800 shadow-2xl">
            {loadingLabel}
          </div>
        </div>
      ) : null}

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm print:hidden">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-950">Shipping Control</h2>
            <p className="mt-1 text-sm text-slate-500">
              Manual pickups, drop offs, manifest history, and BOM release paperwork.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/address-book"
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
            >
              Address Book
            </Link>
            <button
              type="button"
              onClick={() => addStop('incoming')}
              className="rounded-xl bg-cyan-700 px-4 py-2 text-sm font-bold text-white hover:bg-cyan-800"
            >
              Add Pickup
            </button>
            <button
              type="button"
              onClick={() => addStop('outgoing')}
              className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-bold text-white hover:bg-slate-800"
            >
              Add Drop Off
            </button>
            <button
              type="button"
              onClick={() => printElementById('print-selected-manifest')}
              disabled={!selectedDateManifestRows.length}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Print Manifest
            </button>
          </div>
        </div>

        {message ? (
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
            {message}
          </div>
        ) : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-5 print:hidden">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <label className="block text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
            Manifest Date
          </label>
          <input
            type="date"
            value={selectedManifestDate}
            onChange={(event) => changeManifestDate(event.target.value)}
            className="mt-2 h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900"
          />
        </div>

        <Stat label="Selected Manifest" value={selectedDateManifestNumber || 'DAI-Mâ€”'} />
        <Stat label="Pickups" value={String(pickups.length)} />
        <Stat label="Drop Offs" value={String(dropOffs.length)} />
        <Stat label="Saved BOMs" value={String(bomDrafts.length)} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-base font-bold text-slate-950">Pickups for Selected Date</h3>
          <StopsTable
            rows={pickups}
            mode="pickup"
            emptyText={`No pickups for ${selectedManifestDate}.`}
            onOpen={setSelectedRow}
          />
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-base font-bold text-slate-950">Drop Offs for Selected Date</h3>
          <StopsTable
            rows={dropOffs}
            mode="dropoff"
            emptyText={`No drop offs for ${selectedManifestDate}.`}
            onOpen={setSelectedRow}
          />
        </section>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm print:hidden">
        <h3 className="text-base font-bold text-slate-950">Manifest History</h3>
        <div className="mt-4 overflow-auto rounded-xl border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
              <tr>
                <th className="px-3 py-3">Date / Manifest</th>
                <th className="px-3 py-3">Stops</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {groupedByDate.length ? (
                groupedByDate.flatMap(([date, manifestsMap]) =>
                  Array.from(manifestsMap.entries())
                    .sort((a, b) => parseManifestNumber(b[0]) - parseManifestNumber(a[0]))
                    .map(([manifestNumber, manifestRows], index) => (
                      <tr key={`${date}-${manifestNumber}`} className="hover:bg-slate-50">
                        <td className="px-3 py-3 font-bold text-slate-950">
                          {index === 0 ? (
                            <div className="mb-2 text-xs font-bold text-slate-500">{date}</div>
                          ) : null}
                          {manifestNumber}
                        </td>
                        <td className="px-3 py-3">{manifestRows.length}</td>
                        <td className="px-3 py-3">Open</td>
                        <td className="px-3 py-3 text-right">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => openManifest(manifestNumber, date)}
                              className="rounded-lg bg-cyan-700 px-3 py-2 text-xs font-bold text-white hover:bg-cyan-800"
                            >
                              Open
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                printElementById(`print-manifest-history-${date}-${manifestNumber}`)
                              }
                              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
                            >
                              Print
                            </button>
                          </div>

                          <PrintableManifest
                            manifestNumber={manifestNumber}
                            manifestDate={date}
                            printId={`print-manifest-history-${date}-${manifestNumber}`}
                            rows={manifestRows.filter(
                              (row) => row.manifestNumber === manifestNumber && row.date === date
                            )}
                          />
                        </td>
                      </tr>
                    ))
                )
              ) : (
                <tr>
                  <td colSpan={4} className="px-3 py-8 text-center text-sm text-slate-500">
                    No manifest history yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm print:hidden">
        <h3 className="text-base font-bold text-slate-950">BOM / Release History</h3>
        <div className="mt-4 overflow-auto rounded-xl border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
              <tr>
                <th className="px-3 py-3">BOM #</th>
                <th className="px-3 py-3">Manifest</th>
                <th className="px-3 py-3">Reference</th>
                <th className="px-3 py-3">Ship To</th>
                <th className="px-3 py-3 text-right">Print</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {bomDrafts.length ? (
                bomDrafts.map((bom) => (
                  <tr key={bom.bomNumber} className="align-top hover:bg-slate-50">
                    <td className="px-3 py-3 font-bold text-slate-950">{bom.bomNumber}</td>
                    <td className="px-3 py-3">{bom.manifestNumber || '-'}</td>
                    <td className="px-3 py-3">{bom.reference || '-'}</td>
                    <td className="whitespace-pre-line px-3 py-3">{bom.shipTo || '-'}</td>
                    <td className="px-3 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => printElementById(`print-bom-${bom.bomNumber}`)}
                        className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
                      >
                        Print
                      </button>
                      <PrintableBom bom={bom} />
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-3 py-8 text-center text-sm text-slate-500">
                    No BOMs created yet. Open a drop off and select Create BOM.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <PrintableManifest
        manifestNumber={selectedDateManifestNumber}
        manifestDate={selectedManifestDate}
        printId="print-selected-manifest"
        rows={selectedDateManifestRows}
      />

      <ManifestModal
        manifestNumber={selectedManifestNumber}
        manifestDate={selectedManifestDate}
        rows={selectedManifestRows}
        onClose={() => setSelectedManifestNumber('')}
        onSave={saveSelectedManifest}
        onPrint={() =>
          printElementById(`print-manifest-modal-${selectedManifestDate}-${selectedManifestNumber}`)
        }
        onEditStop={setSelectedRow}
      />

      <StopModal
        row={selectedRow}
        locations={locations}
        onClose={() => setSelectedRow(null)}
        onSave={handleSaveRow}
        onCreateBom={handleCreateBom}
      />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">{label}</div>
      <div className="mt-2 text-2xl font-bold text-slate-950">{value}</div>
    </div>
  );
}

