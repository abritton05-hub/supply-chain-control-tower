'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import type { DeliveryPageData } from './types';

const DEFAULT_SITE = 'SEA991';
const MANIFEST_START = 1501;
const BOM_START = 13501;

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

function normalizeLocation(value: string) {
  const clean = value.trim().toUpperCase();

  if (clean === 'WH') return 'WH/A13';
  if (clean === 'A13') return 'WH/A13';
  if (clean === 'WH/A13') return 'WH/A13';

  return clean;
}

function locationOptionLabel(location: ShippingLocation) {
  const code = normalizeLocation(location.code || '');
  const displayName = (location.display_name || '').trim();

  if (!displayName || normalizeLocation(displayName) === code) {
    return code;
  }

  return `${code} — ${displayName}`;
}

function formatType(direction: Direction) {
  return direction === 'incoming' ? 'Pickup' : 'Drop Off';
}

function createManifestNumber(existingManifestNumbers: string[]) {
  const used = existingManifestNumbers
    .map((value) => Number(value.replace('DAI-M', '').replace('DAI-M-', '')))
    .filter((value) => Number.isFinite(value));

  const next = used.length ? Math.max(...used) + 1 : MANIFEST_START;
  return `DAI-M${next}`;
}

function createBomNumber(existingBomNumbers: string[]) {
  const used = existingBomNumbers
    .map((value) => Number(value.replace('DAI-B', '').replace('DAI-B-', '')))
    .filter((value) => Number.isFinite(value));

  const next = used.length ? Math.max(...used) + 1 : BOM_START;
  return `DAI-B${next}`;
}

function addressForLocation(locations: ShippingLocation[], code: string) {
  const normalized = normalizeLocation(code);
  return (
    locations.find((location) => normalizeLocation(location.code) === normalized)?.address || ''
  );
}

function contactForLocation(locations: ShippingLocation[], code: string) {
  const normalized = normalizeLocation(code);
  const location = locations.find((item) => normalizeLocation(item.code) === normalized);

  if (!location) return '';

  return [location.contact_name || '', location.contact_phone || ''].filter(Boolean).join(' | ');
}

function displayStopAddress(location: string, address: string) {
  const cleanLocation = location.trim();
  const cleanAddress = address.trim();

  if (!cleanLocation && !cleanAddress) return '-';
  if (!cleanAddress) return cleanLocation;
  if (!cleanLocation) return cleanAddress;

  return `${cleanLocation}\n${cleanAddress}`;
}

function emptyStop(
  direction: Direction,
  manifestNumber: string,
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
    date: today(),
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
    reference: row.reference || '',
    fromLocation: row.from_location || '',
    fromAddress: row.from_address || '',
    toLocation: row.to_location || '',
    toAddress: row.to_address || '',
    contact: row.contact || '',
    items: row.items || '',
    notes: row.notes || '',
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
    reference: row.reference || '',
    shipFrom: row.ship_from || '',
    shipTo: row.ship_to || '',
    contact: row.contact || '',
    items: row.items || '',
    notes: row.notes || '',
  }));
}

async function saveManifestRow(row: StopRow) {
  const res = await fetch('/api/shipping/manifest-history', {
    method: 'POST',
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
      contact: row.contact,
      items: row.items,
      notes: row.notes,
      status: row.status,
    }),
  });

  const data = await res.json();
  if (!data.ok) throw new Error(data.message || 'Failed to save manifest stop.');
}

async function updateManifestRow(row: StopRow) {
  const res = await fetch('/api/shipping/manifest-history', {
    method: 'PATCH',
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
      contact: row.contact,
      items: row.items,
      notes: row.notes,
      status: row.status,
    }),
  });

  const data = await res.json();
  if (!data.ok) throw new Error(data.message || 'Failed to update manifest stop.');
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

  const printWindow = window.open('', '_blank', 'width=1000,height=800');
  if (!printWindow) return;

  printWindow.document.write(`
    <html>
      <head>
        <title>Print</title>
        <style>
          body { font-family: Arial, sans-serif; color: #0f172a; padding: 24px; }
          h1, h2, h3 { margin: 0; }
          table { width: 100%; border-collapse: collapse; margin-top: 16px; }
          th, td { border: 1px solid #cbd5e1; padding: 8px; text-align: left; vertical-align: top; font-size: 12px; }
          th { background: #f1f5f9; text-transform: uppercase; font-size: 11px; }
          .header { border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 16px; }
          .meta { margin-top: 12px; display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 13px; }
          .box { border: 1px solid #cbd5e1; padding: 10px; margin-top: 12px; }
          pre { white-space: pre-wrap; font-family: Arial, sans-serif; font-size: 13px; }
          .signature-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 24px; }
          .signature-line { border-bottom: 1px solid #0f172a; height: 28px; }
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

  const isDropOff = draft.direction === 'outgoing';

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
          contact: current.direction === 'incoming' ? contact || current.contact : current.contact,
        };
      }

      return {
        ...current,
        toLocation: normalized,
        toAddress: address,
        contact: current.direction === 'outgoing' ? contact || current.contact : current.contact,
      };
    });
  }

  function addBlankItemLine() {
    update('items', draft.items.trim() ? `${draft.items.trim()}\n1x ` : '1x ');
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

          <label className="text-sm font-semibold text-slate-700">
            Title
            <input
              value={draft.title}
              onChange={(event) => update('title', event.target.value)}
              className="mt-1 h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900"
            />
          </label>

          <label className="text-sm font-semibold text-slate-700">
            Date
            <input
              type="date"
              value={draft.date}
              onChange={(event) => update('date', event.target.value)}
              className="mt-1 h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900"
            />
          </label>

          <label className="text-sm font-semibold text-slate-700">
            Time / Window
            <input
              type="text"
              value={draft.time}
              onChange={(event) => update('time', event.target.value)}
              placeholder="10:30 AM-12:00 PM"
              className="mt-1 h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900"
            />
          </label>

          <label className="text-sm font-semibold text-slate-700">
            PO / Shipment / Transfer ID
            <input
              value={draft.shipmentTransferId}
              onChange={(event) => update('shipmentTransferId', event.target.value)}
              className="mt-1 h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900"
            />
          </label>

          <label className="text-sm font-semibold text-slate-700">
            Reference / Project
            <input
              value={draft.reference}
              onChange={(event) => update('reference', event.target.value)}
              className="mt-1 h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900"
            />
          </label>

          <label className="text-sm font-semibold text-slate-700">
            From
            <select
              value={draft.fromLocation}
              onChange={(event) => updateLocation('fromLocation', event.target.value)}
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

          <label className="text-sm font-semibold text-slate-700">
            To
            <select
              value={draft.toLocation}
              onChange={(event) => updateLocation('toLocation', event.target.value)}
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

          <label className="text-sm font-semibold text-slate-700">
            From Address
            <textarea
              value={draft.fromAddress}
              onChange={(event) => update('fromAddress', event.target.value)}
              className="mt-1 min-h-[96px] w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
            />
          </label>

          <label className="text-sm font-semibold text-slate-700">
            To Address
            <textarea
              value={draft.toAddress}
              onChange={(event) => update('toAddress', event.target.value)}
              className="mt-1 min-h-[96px] w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
            />
          </label>

          <label className="text-sm font-semibold text-slate-700 md:col-span-2">
            Contact / POC
            <input
              value={draft.contact}
              onChange={(event) => update('contact', event.target.value)}
              placeholder="Only use when there is a real name or phone number"
              className="mt-1 h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900"
            />
          </label>

          <div className="md:col-span-2">
            <div className="flex items-center justify-between gap-3">
              <label className="text-sm font-semibold text-slate-700">
                Items / PN / Qty
              </label>
              <button
                type="button"
                onClick={addBlankItemLine}
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
              >
                Add Item Line
              </button>
            </div>

            <textarea
              value={draft.items || ''}
              onChange={(event) => update('items', event.target.value)}
              placeholder="5x 150619-071&#10;5x 150619-003"
              className="mt-1 min-h-[150px] w-full rounded-xl border border-slate-300 bg-white px-3 py-2 font-mono text-sm text-slate-900"
              spellCheck={false}
            />
          </div>

          <label className="text-sm font-semibold text-slate-700 md:col-span-2">
            Notes
            <textarea
              value={draft.notes || ''}
              onChange={(event) => update('notes', event.target.value)}
              className="mt-1 min-h-[100px] w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
            />
          </label>
        </div>

        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={() => onSave(draft)}
            className="rounded-xl bg-cyan-700 px-4 py-2 text-sm font-bold text-white hover:bg-cyan-800"
          >
            Save Changes
          </button>

          {isDropOff ? (
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

function PrintableBom({ bom }: { bom: BomDraft }) {
  return (
    <div id={`print-bom-${bom.bomNumber}`} className="hidden">
      <div className="header">
        <h1>DENALI ADVANCED INTEGRATION</h1>
        <h2>BOM / Release</h2>
        <p>BOM #: {bom.bomNumber}</p>
        <p>Manifest #: {bom.manifestNumber}</p>
      </div>

      <div className="meta">
        <div>
          <strong>Created:</strong> {bom.createdAt}
        </div>
        <div>
          <strong>Reference:</strong> {bom.reference || '-'}
        </div>
        <div>
          <strong>Ship From:</strong> {bom.shipFrom || '-'}
        </div>
        <div>
          <strong>Ship To:</strong> {bom.shipTo || '-'}
        </div>
        <div>
          <strong>Contact / POC:</strong> {bom.contact || '-'}
        </div>
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
              <tr key={`${bom.bomNumber}-${index}`}>
                <td>{index + 1}</td>
                <td>{item}</td>
              </tr>
            ))}
        </tbody>
      </table>

      <div className="box">
        <strong>Notes</strong>
        <pre>{bom.notes || '-'}</pre>
      </div>

      <div className="signature-grid">
        <div>
          <strong>Authorized for Release</strong>
          <div className="signature-line" />
        </div>
        <div>
          <strong>Date / Time</strong>
          <div className="signature-line" />
        </div>
        <div>
          <strong>Released To</strong>
          <div className="signature-line" />
        </div>
        <div>
          <strong>Signature</strong>
          <div className="signature-line" />
        </div>
      </div>
    </div>
  );
}

function PrintableManifest({ manifestNumber, rows }: { manifestNumber: string; rows: StopRow[] }) {
  return (
    <div id={`print-manifest-${manifestNumber}`} className="hidden">
      <div className="header">
        <h1>DENALI ADVANCED INTEGRATION</h1>
        <h2>Driver Manifest</h2>
        <p>Manifest #: {manifestNumber}</p>
        <p>Date: {today()}</p>
      </div>

      <table>
        <thead>
          <tr>
            <th>Type</th>
            <th>Date / Time</th>
            <th>From</th>
            <th>To</th>
            <th>PO / Ref</th>
            <th>Items</th>
            <th>Contact</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`print-${row.id}`}>
              <td>{formatType(row.direction)}</td>
              <td>
                {row.date || '-'}
                <br />
                {row.time || '-'}
              </td>
              <td>
                <pre>{displayStopAddress(row.fromLocation, row.fromAddress)}</pre>
              </td>
              <td>
                <pre>{displayStopAddress(row.toLocation, row.toAddress)}</pre>
              </td>
              <td>
                {row.shipmentTransferId || '-'}
                <br />
                {row.reference || ''}
              </td>
              <td>
                <pre>{row.items || '-'}</pre>
              </td>
              <td>{row.contact || '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="signature-grid">
        <div>
          <strong>Driver Name</strong>
          <div className="signature-line" />
        </div>
        <div>
          <strong>Date / Time</strong>
          <div className="signature-line" />
        </div>
        <div>
          <strong>Released By</strong>
          <div className="signature-line" />
        </div>
        <div>
          <strong>Receiver Signature</strong>
          <div className="signature-line" />
        </div>
      </div>
    </div>
  );
}

export function DeliveryClient(_props: DeliveryPageData) {
  const [rows, setRows] = useState<StopRow[]>([]);
  const [locations, setLocations] = useState<ShippingLocation[]>([]);
  const [selectedRow, setSelectedRow] = useState<StopRow | null>(null);
  const [bomDrafts, setBomDrafts] = useState<BomDraft[]>([]);
  const [currentManifestNumber, setCurrentManifestNumber] = useState('');
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

    const nextManifestNumber = createManifestNumber(
      manifestRows.map((row) => row.manifestNumber).filter(Boolean)
    );

    setCurrentManifestNumber(nextManifestNumber);
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

  const currentRows = rows.filter((row) => row.manifestNumber === currentManifestNumber);
  const pickups = currentRows.filter((row) => row.direction === 'incoming');
  const dropOffs = currentRows.filter((row) => row.direction === 'outgoing');

  const groupedManifests = useMemo(() => {
    const groups = new Map<string, StopRow[]>();

    for (const row of rows) {
      const manifestNumber = row.manifestNumber || 'Unassigned';
      const current = groups.get(manifestNumber) || [];
      current.push(row);
      groups.set(manifestNumber, current);
    }

    return Array.from(groups.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [rows]);

  async function addStop(direction: Direction) {
    try {
      const manifestNumber = currentManifestNumber || createManifestNumber([]);
      const row = emptyStop(direction, manifestNumber, locations);

      setLoadingLabel(`Creating ${formatType(direction)}...`);
      await saveManifestRow(row);
      await refreshData();
      setSelectedRow(row);
      setMessage(`${formatType(direction)} recorded under manifest ${manifestNumber}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : `${formatType(direction)} save failed.`);
    } finally {
      setLoadingLabel('');
    }
  }

  async function handleSaveRow(row: StopRow) {
    try {
      setLoadingLabel('Saving manifest stop...');
      await updateManifestRow(row);
      await refreshData();
      setSelectedRow(null);
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
        contact: row.contact,
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

  const allCurrentRows = [...pickups, ...dropOffs];

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
            <h2 className="text-lg font-bold text-slate-950">Shipping & Delivery Control</h2>
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
              onClick={() => printElementById(`print-manifest-${currentManifestNumber}`)}
              disabled={!allCurrentRows.length}
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

      <div className="grid gap-4 lg:grid-cols-4 print:hidden">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
            Current Manifest
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-950">
            {currentManifestNumber || 'Loading'}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
            Pickups
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-950">{pickups.length}</div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
            Drop Offs
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-950">{dropOffs.length}</div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
            Saved BOMs
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-950">{bomDrafts.length}</div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-base font-bold text-slate-950">Pickups</h3>
          <div className="mt-4 overflow-auto rounded-xl border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
                <tr>
                  <th className="px-3 py-3">Date</th>
                  <th className="px-3 py-3">From</th>
                  <th className="px-3 py-3">PO / Ref</th>
                  <th className="px-3 py-3">Items</th>
                  <th className="px-3 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {pickups.length ? (
                  pickups.map((row) => (
                    <tr key={row.id} className="align-top hover:bg-slate-50">
                      <td className="px-3 py-3">{row.date || '-'}</td>
                      <td className="px-3 py-3 whitespace-pre-line">
                        {displayStopAddress(row.fromLocation, row.fromAddress)}
                      </td>
                      <td className="px-3 py-3">
                        <div>{row.shipmentTransferId || '-'}</div>
                        <div className="text-xs text-slate-500">{row.reference || ''}</div>
                      </td>
                      <td className="px-3 py-3 whitespace-pre-line">{row.items || '-'}</td>
                      <td className="px-3 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => setSelectedRow(row)}
                          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
                        >
                          Open
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="px-3 py-8 text-center text-sm text-slate-500">
                      No pickups on the current manifest.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-base font-bold text-slate-950">Drop Offs</h3>
          <div className="mt-4 overflow-auto rounded-xl border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
                <tr>
                  <th className="px-3 py-3">Date</th>
                  <th className="px-3 py-3">To</th>
                  <th className="px-3 py-3">PO / Ref</th>
                  <th className="px-3 py-3">Items</th>
                  <th className="px-3 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {dropOffs.length ? (
                  dropOffs.map((row) => (
                    <tr key={row.id} className="align-top hover:bg-slate-50">
                      <td className="px-3 py-3">{row.date || '-'}</td>
                      <td className="px-3 py-3 whitespace-pre-line">
                        {displayStopAddress(row.toLocation, row.toAddress)}
                      </td>
                      <td className="px-3 py-3">
                        <div>{row.shipmentTransferId || '-'}</div>
                        <div className="text-xs text-slate-500">{row.reference || ''}</div>
                      </td>
                      <td className="px-3 py-3 whitespace-pre-line">{row.items || '-'}</td>
                      <td className="px-3 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => setSelectedRow(row)}
                          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
                        >
                          Open
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="px-3 py-8 text-center text-sm text-slate-500">
                      No drop offs on the current manifest.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm print:hidden">
        <h3 className="text-base font-bold text-slate-950">Manifest History</h3>
        <div className="mt-4 overflow-auto rounded-xl border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
              <tr>
                <th className="px-3 py-3">Manifest</th>
                <th className="px-3 py-3">Stops</th>
                <th className="px-3 py-3">First Date</th>
                <th className="px-3 py-3 text-right">Print</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {groupedManifests.length ? (
                groupedManifests.map(([manifestNumber, manifestRows]) => (
                  <tr key={manifestNumber} className="hover:bg-slate-50">
                    <td className="px-3 py-3 font-bold text-slate-950">{manifestNumber}</td>
                    <td className="px-3 py-3">{manifestRows.length}</td>
                    <td className="px-3 py-3">{manifestRows[0]?.date || '-'}</td>
                    <td className="px-3 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => printElementById(`print-manifest-${manifestNumber}`)}
                        className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
                      >
                        Print
                      </button>
                      <PrintableManifest manifestNumber={manifestNumber} rows={manifestRows} />
                    </td>
                  </tr>
                ))
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
                    <td className="px-3 py-3 whitespace-pre-line">{bom.shipTo || '-'}</td>
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

      <PrintableManifest manifestNumber={currentManifestNumber} rows={allCurrentRows} />

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