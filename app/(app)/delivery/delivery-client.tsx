'use client';

import { useEffect, useMemo, useState } from 'react';
import { DELIVERY_DRAFT_STORAGE_KEY } from '@/lib/ai/intake/draft-storage';
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

function newId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function formatType(direction: Direction) {
  return direction === 'incoming' ? 'Pickup' : 'Drop-Off';
}

function normalizeLocation(value: string) {
  const clean = value.trim().toUpperCase();

  if (clean === 'WH') return 'WH/A13';
  if (clean === 'A13') return 'WH/A13';
  if (clean === 'WH/A13') return 'WH/A13';

  return clean;
}

function createManifestNumber(existingManifestNumbers: string[]) {
  const used = existingManifestNumbers
    .map((value) => Number(value.replace('DAI-M', '')))
    .filter((value) => Number.isFinite(value));

  const next = used.length ? Math.max(...used) + 1 : MANIFEST_START;
  return `DAI-M${next}`;
}

function createBomNumber(existingBomNumbers: string[]) {
  const used = existingBomNumbers
    .map((value) => Number(value.replace('DAI-B', '')))
    .filter((value) => Number.isFinite(value));

  const next = used.length ? Math.max(...used) + 1 : BOM_START;
  return `DAI-B${next}`;
}

function addressForLocation(locations: ShippingLocation[], code: string) {
  const normalized = normalizeLocation(code);
  return locations.find((location) => location.code === normalized)?.address || '';
}

async function loadShippingLocations(): Promise<ShippingLocation[]> {
  const res = await fetch('/api/shipping/locations', { cache: 'no-store' });
  const data = await res.json();

  if (!data.ok) throw new Error(data.message || 'Failed to load shipping locations.');

  return data.locations || [];
}

async function saveShippingLocation(location: ShippingLocation) {
  const res = await fetch('/api/shipping/locations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      code: location.code,
      display_name: location.display_name,
      address: location.address || '',
      contact_name: location.contact_name || '',
      contact_phone: location.contact_phone || '',
      notes: location.notes || '',
    }),
  });

  const data = await res.json();

  if (!data.ok) throw new Error(data.message || 'Failed to save location.');
}

async function loadManifestRows(): Promise<StopRow[]> {
  const res = await fetch('/api/shipping/manifest-history', { cache: 'no-store' });
  const data = await res.json();

  if (!data.ok) throw new Error(data.message || 'Failed to load manifest history.');

  return (data.rows || []).map((row: any) => ({
    id: row.id,
    manifestNumber: row.manifest_number || '',
    direction: row.direction,
    title: row.title,
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
    bomNumber: row.bom_number,
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

  const printWindow = window.open('', '_blank', 'width=900,height=700');
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
        </style>
      </head>
      <body>${element.innerHTML}</body>
    </html>
  `);

  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
}

function LocationAddressBook({
  locations,
  onSave,
}: {
  locations: ShippingLocation[];
  onSave: (location: ShippingLocation) => void;
}) {
  const [draftCode, setDraftCode] = useState(locations[0]?.code || 'SEA991');

  const current =
    locations.find((location) => location.code === draftCode) ||
    ({
      code: draftCode,
      display_name: draftCode,
      address: '',
      contact_name: '',
      contact_phone: '',
      notes: '',
    } satisfies ShippingLocation);

  const [draft, setDraft] = useState<ShippingLocation>(current);

  useEffect(() => {
    const selected =
      locations.find((location) => location.code === draftCode) ||
      ({
        code: draftCode,
        display_name: draftCode,
        address: '',
        contact_name: '',
        contact_phone: '',
        notes: '',
      } satisfies ShippingLocation);

    setDraft(selected);
  }, [draftCode, locations]);

  function update(field: keyof ShippingLocation, value: string) {
    setDraft((currentDraft) => ({
      ...currentDraft,
      [field]: value,
    }));
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm print:hidden">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-slate-900">Location Address Book</h3>
          <p className="mt-1 text-sm text-slate-500">
            Save addresses here. Manifest From/To addresses auto-fill from these location codes.
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-4">
        <label className="text-sm font-semibold text-slate-700">
          Location
          <select
            value={draftCode}
            onChange={(event) => setDraftCode(event.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            {locations.map((location) => (
              <option key={location.code} value={location.code}>
                {location.code}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm font-semibold text-slate-700 md:col-span-3">
          Display Name
          <input
            value={draft.display_name || ''}
            onChange={(event) => update('display_name', event.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
          />
        </label>

        <label className="text-sm font-semibold text-slate-700 md:col-span-4">
          Address
          <textarea
            value={draft.address || ''}
            onChange={(event) => update('address', event.target.value)}
            className="mt-1 min-h-[80px] w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
            placeholder="Street, city, state, zip"
          />
        </label>

        <label className="text-sm font-semibold text-slate-700">
          Contact Name
          <input
            value={draft.contact_name || ''}
            onChange={(event) => update('contact_name', event.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
          />
        </label>

        <label className="text-sm font-semibold text-slate-700">
          Contact Phone
          <input
            value={draft.contact_phone || ''}
            onChange={(event) => update('contact_phone', event.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
          />
        </label>

        <label className="text-sm font-semibold text-slate-700 md:col-span-2">
          Notes
          <input
            value={draft.notes || ''}
            onChange={(event) => update('notes', event.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
          />
        </label>
      </div>

      <div className="mt-4 flex justify-end">
        <button
          type="button"
          onClick={() => onSave(draft)}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
        >
          Save Address
        </button>
      </div>
    </section>
  );
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

    setDraft((current) => {
      if (!current) return current;

      if (field === 'fromLocation') {
        return {
          ...current,
          fromLocation: normalized,
          fromAddress: address,
        };
      }

      return {
        ...current,
        toLocation: normalized,
        toAddress: address,
      };
    });
  }

  function addBlankItemLine() {
    update('items', draft.items.trim() ? `${draft.items.trim()}\n1x ` : '1x ');
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              {formatType(draft.direction)} Details
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Manifest {draft.manifestNumber}. Addresses auto-fill from the address book.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-300 px-3 py-1 text-sm font-semibold text-slate-700 hover:bg-slate-50"
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
              className="mt-1 w-full rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-700"
            />
          </label>

          <label className="text-sm font-semibold text-slate-700">
            Title
            <input
              value={draft.title}
              onChange={(event) => update('title', event.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
            />
          </label>

          <label className="text-sm font-semibold text-slate-700">
            Date
            <input
              type="date"
              value={draft.date}
              onChange={(event) => update('date', event.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
            />
          </label>

          <label className="text-sm font-semibold text-slate-700">
            Time / Window
            <input
              type="text"
              value={draft.time}
              onChange={(event) => update('time', event.target.value)}
              placeholder="10:30 AM-12:00 PM"
              className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
            />
          </label>

          <label className="text-sm font-semibold text-slate-700">
            PO / Shipment / Transfer ID
            <input
              value={draft.shipmentTransferId}
              onChange={(event) => update('shipmentTransferId', event.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
            />
          </label>

          <label className="text-sm font-semibold text-slate-700">
            Reference
            <input
              value={draft.reference}
              onChange={(event) => update('reference', event.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
            />
          </label>

          <label className="text-sm font-semibold text-slate-700">
            From
            <select
              value={draft.fromLocation}
              onChange={(event) => updateLocation('fromLocation', event.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
            >
              <option value="">Select location</option>
              {locations.map((location) => (
                <option key={location.code} value={location.code}>
                  {location.code}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm font-semibold text-slate-700">
            To
            <select
              value={draft.toLocation}
              onChange={(event) => updateLocation('toLocation', event.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
            >
              <option value="">Select location</option>
              {locations.map((location) => (
                <option key={location.code} value={location.code}>
                  {location.code}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm font-semibold text-slate-700">
            From Address
            <textarea
              value={draft.fromAddress}
              onChange={(event) => update('fromAddress', event.target.value)}
              className="mt-1 min-h-[90px] w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
            />
          </label>

          <label className="text-sm font-semibold text-slate-700">
            To Address
            <textarea
              value={draft.toAddress}
              onChange={(event) => update('toAddress', event.target.value)}
              className="mt-1 min-h-[90px] w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
            />
          </label>

          <label className="text-sm font-semibold text-slate-700 md:col-span-2">
            Contact / POC
            <input
              value={draft.contact}
              onChange={(event) => update('contact', event.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
            />
          </label>

          <div className="md:col-span-2">
            <div className="flex items-center justify-between gap-3">
              <label className="text-sm font-semibold text-slate-700">Items</label>
              <button
                type="button"
                onClick={addBlankItemLine}
                className="rounded-md border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Add Item Line
              </button>
            </div>

            <textarea
              value={draft.items || ''}
              onChange={(event) => update('items', event.target.value)}
              className="mt-1 min-h-[140px] w-full rounded-md border border-slate-300 bg-white px-3 py-2 font-mono text-sm text-slate-900"
              spellCheck={false}
            />
          </div>

          <label className="text-sm font-semibold text-slate-700 md:col-span-2">
            Notes
            <textarea
              value={draft.notes || ''}
              onChange={(event) => update('notes', event.target.value)}
              className="mt-1 min-h-[110px] w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
            />
          </label>
        </div>

        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={() => onSave(draft)}
            className="rounded-md bg-cyan-700 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-800"
          >
            Save Changes
          </button>

          {isDropOff ? (
            <button
              type="button"
              onClick={() => onCreateBom(draft)}
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
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
        <h1>BOM / Release</h1>
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
            <th>Item</th>
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

      <div className="box">
        <strong>Signatures</strong>
        <p>Authorized for Release: __________________________ Date: __________</p>
        <p>Released To: __________________________ Signature: __________</p>
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
        const [manifestRows, bomRows, shippingLocations] = await Promise.all([
          loadManifestRows(),
          loadBomRows(),
          loadShippingLocations(),
        ]);

        const rawDraft = window.localStorage.getItem(DELIVERY_DRAFT_STORAGE_KEY);
        const manifestNumber = createManifestNumber(
          manifestRows.map((row) => row.manifestNumber).filter(Boolean)
        );

        setCurrentManifestNumber(manifestNumber);
        setLocations(shippingLocations);

        if (rawDraft) {
          const draft = JSON.parse(rawDraft);
          const isPickup = draft.direction === 'pickup' || draft.direction === 'incoming';
          const isDropOff = !isPickup;
          const fromLocation = normalizeLocation(
            draft.pickup_location || (isDropOff ? DEFAULT_SITE : '')
          );
          const toLocation = normalizeLocation(
            draft.dropoff_location || (isPickup ? DEFAULT_SITE : '')
          );

          const row: StopRow = {
            id: newId('intake'),
            manifestNumber,
            direction: isPickup ? 'incoming' : 'outgoing',
            title: isPickup ? 'Pickup' : 'Drop-Off',
            date: draft.requested_date || new Date().toISOString().slice(0, 10),
            time: draft.requested_time || '',
            shipmentTransferId: draft.shipment_transfer_id || '',
            reference: draft.project_or_work_order || '',
            fromLocation,
            fromAddress: addressForLocation(shippingLocations, fromLocation),
            toLocation,
            toAddress: addressForLocation(shippingLocations, toLocation),
            contact: draft.contact_name || '',
            items: draft.items || '',
            notes: draft.notes || '',
            status: 'Draft',
            createdAt: new Date().toISOString(),
          };

          await saveManifestRow(row);
          window.localStorage.removeItem(DELIVERY_DRAFT_STORAGE_KEY);
          setMessage(`Transaction recorded under manifest ${manifestNumber}.`);

          const nextRows = await loadManifestRows();
          setRows(nextRows);
        } else {
          setRows(manifestRows);
        }

        setBomDrafts(bomRows);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : 'Shipping data failed to load.');
      }
    }

    init();
  }, []);

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

  const currentRows = rows.filter((row) => row.manifestNumber === currentManifestNumber);
  const pickups = currentRows.filter((row) => row.direction === 'incoming');
  const dropOffs = currentRows.filter((row) => row.direction === 'outgoing');

  async function handleSaveLocation(location: ShippingLocation) {
    try {
      const normalizedLocation = {
        ...location,
        code: normalizeLocation(location.code),
        display_name: location.display_name || normalizeLocation(location.code),
      };

      await saveShippingLocation(normalizedLocation);
      await refreshData();
      setMessage(`${normalizedLocation.code} address saved.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Location save failed.');
    }
  }

  async function addPickup() {
    try {
      const fromLocation = '';
      const toLocation = DEFAULT_SITE;

      const row: StopRow = {
        id: newId('pickup'),
        manifestNumber: currentManifestNumber,
        direction: 'incoming',
        title: 'Pickup',
        date: new Date().toISOString().slice(0, 10),
        time: '',
        shipmentTransferId: '',
        reference: '',
        fromLocation,
        fromAddress: '',
        toLocation,
        toAddress: addressForLocation(locations, toLocation),
        contact: '',
        items: '',
        notes: '',
        status: 'Manual',
        createdAt: new Date().toISOString(),
      };

      await saveManifestRow(row);
      await refreshData();
      setMessage(`Pickup recorded under manifest ${currentManifestNumber}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Pickup save failed.');
    }
  }

  async function addDropOff() {
    try {
      const fromLocation = DEFAULT_SITE;
      const toLocation = '';

      const row: StopRow = {
        id: newId('dropoff'),
        manifestNumber: currentManifestNumber,
        direction: 'outgoing',
        title: 'Drop-Off',
        date: new Date().toISOString().slice(0, 10),
        time: '',
        shipmentTransferId: '',
        reference: '',
        fromLocation,
        fromAddress: addressForLocation(locations, fromLocation),
        toLocation,
        toAddress: '',
        contact: '',
        items: '',
        notes: '',
        status: 'Manual',
        createdAt: new Date().toISOString(),
      };

      await saveManifestRow(row);
      await refreshData();
      setMessage(`Drop-off recorded under manifest ${currentManifestNumber}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Drop-off save failed.');
    }
  }

  async function saveRow(updated: StopRow) {
    try {
      await updateManifestRow(updated);
      await refreshData();
      setSelectedRow(null);
      setMessage(`Transaction updated under manifest ${updated.manifestNumber}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Transaction update failed.');
    }
  }

  async function createBomFromDropOff(row: StopRow) {
    try {
      if (row.direction !== 'outgoing') return;

      const bom: BomDraft = {
        bomNumber: createBomNumber(bomDrafts.map((existing) => existing.bomNumber)),
        manifestNumber: row.manifestNumber,
        sourceStopId: row.id,
        createdAt: new Date().toISOString(),
        reference: row.shipmentTransferId || row.reference,
        shipFrom: row.fromLocation,
        shipTo: row.toLocation,
        contact: row.contact,
        items: row.items,
        notes: row.notes,
      };

      await saveBomRow(bom);
      await refreshData();
      setSelectedRow(null);
      setMessage(`BOM ${bom.bomNumber} recorded under manifest ${row.manifestNumber}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'BOM save failed.');
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Daily Manifest</h2>
          <p className="text-sm text-slate-500">
            Current manifest: <span className="font-semibold">{currentManifestNumber || '-'}</span>
          </p>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={addPickup}
            className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800"
          >
            Add Pickup
          </button>

          <button
            type="button"
            onClick={addDropOff}
            className="rounded-md bg-cyan-700 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-800"
          >
            Add Drop-Off
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Print Manifest
          </button>
        </div>
      </div>

      {message ? (
        <div className="rounded-md border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm text-cyan-800 print:hidden">
          {message}
        </div>
      ) : null}

      <LocationAddressBook locations={locations} onSave={handleSaveLocation} />

      <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-4 py-3">
          <h3 className="text-base font-bold text-slate-900">
            Manifest {currentManifestNumber || '-'}
          </h3>
          <p className="text-sm text-slate-500">
            Pickups: {pickups.length} | Drop-Offs: {dropOffs.length}
          </p>
        </div>

        {currentRows.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">No stops recorded yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Manifest #</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Record</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Time / Window</th>
                  <th className="px-4 py-3">From</th>
                  <th className="px-4 py-3">From Address</th>
                  <th className="px-4 py-3">To</th>
                  <th className="px-4 py-3">To Address</th>
                  <th className="px-4 py-3">PO / Shipment</th>
                  <th className="px-4 py-3">Contact</th>
                  <th className="px-4 py-3">Items</th>
                </tr>
              </thead>

              <tbody>
                {currentRows.map((row) => (
                  <tr
                    key={row.id}
                    onClick={() => setSelectedRow(row)}
                    className="cursor-pointer border-t border-slate-100 hover:bg-slate-50"
                  >
                    <td className="px-4 py-3 font-semibold">{row.manifestNumber}</td>
                    <td className="px-4 py-3 font-semibold">{formatType(row.direction)}</td>
                    <td className="px-4 py-3 font-semibold text-cyan-700">{row.title}</td>
                    <td className="px-4 py-3">{row.date || '-'}</td>
                    <td className="px-4 py-3">{row.time || '-'}</td>
                    <td className="px-4 py-3">{row.fromLocation || '-'}</td>
                    <td className="max-w-xs whitespace-pre-line px-4 py-3 text-xs">
                      {row.fromAddress || '-'}
                    </td>
                    <td className="px-4 py-3">{row.toLocation || '-'}</td>
                    <td className="max-w-xs whitespace-pre-line px-4 py-3 text-xs">
                      {row.toAddress || '-'}
                    </td>
                    <td className="px-4 py-3">{row.shipmentTransferId || '-'}</td>
                    <td className="px-4 py-3">{row.contact || '-'}</td>
                    <td className="whitespace-pre-line px-4 py-3 font-mono">{row.items || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm print:hidden">
        <h3 className="text-base font-bold text-slate-900">Manifest History</h3>

        {groupedManifests.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">No manifests recorded yet.</p>
        ) : (
          <div className="mt-3 space-y-3">
            {groupedManifests.map(([manifestNumber, manifestRows]) => {
              const manifestPickups = manifestRows.filter((row) => row.direction === 'incoming');
              const manifestDropOffs = manifestRows.filter((row) => row.direction === 'outgoing');

              return (
                <div key={manifestNumber} className="rounded-lg border border-slate-200 p-4">
                  <div className="font-bold text-slate-900">{manifestNumber}</div>
                  <div className="mt-1 text-sm text-slate-600">
                    Pickups: {manifestPickups.length} | Drop-Offs: {manifestDropOffs.length}
                  </div>

                  <div className="mt-3 overflow-x-auto">
                    <table className="min-w-full text-left text-sm">
                      <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-500">
                        <tr>
                          <th className="px-3 py-2">Type</th>
                          <th className="px-3 py-2">From</th>
                          <th className="px-3 py-2">To</th>
                          <th className="px-3 py-2">Items</th>
                        </tr>
                      </thead>
                      <tbody>
                        {manifestRows.map((row) => (
                          <tr
                            key={`history-${row.id}`}
                            onClick={() => setSelectedRow(row)}
                            className="cursor-pointer border-t border-slate-100 hover:bg-slate-50"
                          >
                            <td className="px-3 py-2">{formatType(row.direction)}</td>
                            <td className="px-3 py-2">{row.fromLocation || '-'}</td>
                            <td className="px-3 py-2">{row.toLocation || '-'}</td>
                            <td className="whitespace-pre-line px-3 py-2 font-mono">
                              {row.items || '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm print:hidden">
        <h3 className="text-base font-bold text-slate-900">BOM History</h3>

        {bomDrafts.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">No BOMs recorded yet.</p>
        ) : (
          <div className="mt-3 space-y-3">
            {bomDrafts.map((bom) => (
              <div key={bom.bomNumber} className="rounded-lg border border-slate-200 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="font-bold text-slate-900">{bom.bomNumber}</div>
                    <div className="mt-1 text-sm text-slate-600">
                      Manifest: {bom.manifestNumber || '-'}
                    </div>
                    <div className="text-sm text-slate-600">
                      Reference: {bom.reference || '-'}
                    </div>
                    <div className="text-sm text-slate-600">From: {bom.shipFrom || '-'}</div>
                    <div className="text-sm text-slate-600">Ship To: {bom.shipTo || '-'}</div>
                    <div className="text-sm text-slate-600">Contact: {bom.contact || '-'}</div>
                    <div className="text-sm text-slate-600">Created: {bom.createdAt}</div>
                  </div>

                  <button
                    type="button"
                    onClick={() => printElementById(`print-bom-${bom.bomNumber}`)}
                    className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                  >
                    Print BOM
                  </button>
                </div>

                <pre className="mt-3 whitespace-pre-wrap rounded-md bg-slate-50 p-3 text-sm text-slate-800">
                  {bom.items || 'No items entered.'}
                </pre>

                <PrintableBom bom={bom} />
              </div>
            ))}
          </div>
        )}
      </section>

      <StopModal
        row={selectedRow}
        locations={locations}
        onClose={() => setSelectedRow(null)}
        onSave={saveRow}
        onCreateBom={createBomFromDropOff}
      />
    </div>
  );
}

export default DeliveryClient;