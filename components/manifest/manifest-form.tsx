'use client';

import { useMemo, useState } from 'react';

type ManifestDirection = 'outgoing' | 'incoming';
type ManifestStatus = 'Draft' | 'Printed' | 'Completed';

type ManifestLine = {
  item: string;
  part_number: string;
  description: string;
  qty: string;
  unit: string;
};

const EMPTY_LINE: ManifestLine = {
  item: '',
  part_number: '',
  description: '',
  qty: '',
  unit: '',
};

const SEA991_LOCATION = `SEA991
Denali Advanced Integration
17735 NE 65th St Ste 110
Redmond, WA 98052-4924`;

const statusOptions: ManifestStatus[] = ['Draft', 'Printed', 'Completed'];

export function ManifestForm({
  action,
  defaultManifestNumber,
  defaultDate,
  defaultTime,
}: {
  action: (formData: FormData) => void;
  defaultManifestNumber?: string;
  defaultDate: string;
  defaultTime: string;
}) {
  const [direction, setDirection] = useState<ManifestDirection>('outgoing');
  const [fromLocation, setFromLocation] = useState(SEA991_LOCATION);
  const [toLocation, setToLocation] = useState('');
  const [lines, setLines] = useState<ManifestLine[]>(Array.from({ length: 10 }, () => ({ ...EMPTY_LINE })));

  const title = direction === 'outgoing' ? 'Outgoing Material Manifest' : 'Incoming Material Manifest';
  const linePayload = useMemo(() => JSON.stringify(lines), [lines]);

  const updateDirection = (nextDirection: ManifestDirection) => {
    setDirection(nextDirection);
    if (nextDirection === 'outgoing') {
      setFromLocation(SEA991_LOCATION);
      setToLocation('');
    } else {
      setFromLocation('');
      setToLocation(SEA991_LOCATION);
    }
  };

  const updateLine = (lineIndex: number, key: keyof ManifestLine, value: string) => {
    setLines((previous) => previous.map((line, idx) => (idx === lineIndex ? { ...line, [key]: value } : line)));
  };

  return (
    <form action={action} className="space-y-5">
      <section className="erp-card p-4">
        <div className="mb-3 border-b border-slate-200 pb-3">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">Manifest Header</h2>
              <p className="mt-1 text-xs text-slate-500">Capture transfer details, locations, release contacts, and material lines.</p>
            </div>

            <div className="flex rounded-md border border-slate-300 bg-white p-1 text-sm font-semibold">
              <button
                type="button"
                onClick={() => updateDirection('outgoing')}
                className={`rounded px-3 py-2 ${direction === 'outgoing' ? 'bg-cyan-700 text-white' : 'text-slate-700 hover:bg-slate-50'}`}
              >
                Outgoing from SEA991
              </button>
              <span className="flex items-center px-2 text-slate-400" aria-hidden="true">
                &#8644;
              </span>
              <button
                type="button"
                onClick={() => updateDirection('incoming')}
                className={`rounded px-3 py-2 ${direction === 'incoming' ? 'bg-cyan-700 text-white' : 'text-slate-700 hover:bg-slate-50'}`}
              >
                Incoming to SEA991
              </button>
            </div>
          </div>
        </div>

        <div className="mb-4 rounded border border-slate-300 bg-slate-50 px-3 py-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Document Title</p>
          <p className="text-lg font-bold text-slate-900">{title}</p>
        </div>

        <input type="hidden" name="direction" value={direction} />
        <input type="hidden" name="document_title" value={title} />

        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <label className="space-y-1 text-sm">
            <span className="font-medium text-slate-700">Manifest Number</span>
            <input
              name="manifest_number"
              defaultValue={defaultManifestNumber}
              placeholder="Leave blank to auto-generate"
              className="w-full rounded border border-slate-300 px-3 py-2"
            />
            <span className="block text-xs text-slate-500">Auto-number format: MAN-000001</span>
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-medium text-slate-700">Shipment ID / Transfer ID</span>
            <input name="shipment_transfer_id" placeholder="SHIP-24018" className="w-full rounded border border-slate-300 px-3 py-2" />
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-medium text-slate-700">Date</span>
            <input name="date" type="date" defaultValue={defaultDate} className="w-full rounded border border-slate-300 px-3 py-2" required />
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-medium text-slate-700">Time</span>
            <input name="time" type="time" defaultValue={defaultTime} className="w-full rounded border border-slate-300 px-3 py-2" required />
          </label>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-4">
          <label className="space-y-1 text-sm">
            <span className="font-medium text-slate-700">Status</span>
            <select name="status" defaultValue="Draft" className="w-full rounded border border-slate-300 px-3 py-2">
              {statusOptions.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-medium text-slate-700">Driver / Carrier</span>
            <input name="driver_carrier" placeholder="Driver or carrier" className="w-full rounded border border-slate-300 px-3 py-2" />
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-medium text-slate-700">Vehicle</span>
            <input name="vehicle" placeholder="Truck, van, plate, or trailer" className="w-full rounded border border-slate-300 px-3 py-2" />
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-medium text-slate-700">Reference / Project / Work Order</span>
            <input name="reference_project_work_order" placeholder="Reference" className="w-full rounded border border-slate-300 px-3 py-2" />
          </label>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <label className="space-y-1 text-sm">
            <span className="font-medium text-slate-700">From Location</span>
            <textarea
              name="from_location"
              value={fromLocation}
              onChange={(event) => setFromLocation(event.target.value)}
              rows={4}
              className="w-full rounded border border-slate-300 px-3 py-2"
              required
            />
            <span className="block text-xs text-slate-500">
              {direction === 'outgoing' ? 'Defaulted to SEA991 for outgoing material.' : 'Enter the source location for incoming material.'}
            </span>
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-medium text-slate-700">To Location</span>
            <textarea
              name="to_location"
              value={toLocation}
              onChange={(event) => setToLocation(event.target.value)}
              rows={4}
              placeholder="Destination name&#10;Street&#10;City, State ZIP"
              className="w-full rounded border border-slate-300 px-3 py-2"
              required
            />
            <span className="block text-xs text-slate-500">
              {direction === 'incoming' ? 'Defaulted to SEA991 for incoming material.' : 'Enter the destination for outgoing material.'}
            </span>
          </label>
        </div>
      </section>

      <section className="erp-card overflow-auto">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">Manifest Lines</h2>
            <p className="text-xs text-slate-500">10 blank rows are ready. Fully blank rows are ignored on save.</p>
          </div>
          <button
            type="button"
            onClick={() => setLines((previous) => [...previous, { ...EMPTY_LINE }])}
            className="rounded border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Add Line
          </button>
        </div>

        <table className="erp-table min-w-full table-fixed">
          <thead>
            <tr>
              <th className="w-[6%]">#</th>
              <th className="w-[12%]">Item</th>
              <th className="w-[24%]">Part Number</th>
              <th className="w-[38%]">Description</th>
              <th className="w-[10%]">Qty</th>
              <th className="w-[10%]">Unit</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line, index) => (
              <tr key={index}>
                <td className="text-center text-xs font-semibold text-slate-500">{index + 1}</td>
                <td>
                  <input value={line.item} onChange={(event) => updateLine(index, 'item', event.target.value)} className="w-full rounded border border-slate-300 px-2 py-1" />
                </td>
                <td>
                  <input value={line.part_number} onChange={(event) => updateLine(index, 'part_number', event.target.value)} className="w-full rounded border border-slate-300 px-2 py-1" />
                </td>
                <td>
                  <input value={line.description} onChange={(event) => updateLine(index, 'description', event.target.value)} className="w-full rounded border border-slate-300 px-2 py-1" />
                </td>
                <td>
                  <input
                    value={line.qty}
                    onChange={(event) => updateLine(index, 'qty', event.target.value)}
                    className="w-full rounded border border-slate-300 px-2 py-1 text-right"
                    inputMode="decimal"
                    placeholder="0"
                  />
                </td>
                <td>
                  <input value={line.unit} onChange={(event) => updateLine(index, 'unit', event.target.value)} className="w-full rounded border border-slate-300 px-2 py-1" placeholder="EA" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="erp-card p-4">
        <div className="mb-3 border-b border-slate-200 pb-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">Release and Receipt</h2>
          <p className="mt-1 text-xs text-slate-500">Capture release authorization and receiving acknowledgment.</p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <label className="space-y-1 text-sm">
            <span className="font-medium text-slate-700">Authorized for Release By</span>
            <input name="authorized_for_release_by" className="w-full rounded border border-slate-300 px-3 py-2" />
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-medium text-slate-700">Released To (Print Name)</span>
            <input name="released_to_print_name" className="w-full rounded border border-slate-300 px-3 py-2" />
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-medium text-slate-700">Company</span>
            <input name="company" className="w-full rounded border border-slate-300 px-3 py-2" />
          </label>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
          <label className="space-y-1 text-sm">
            <span className="font-medium text-slate-700">Signature</span>
            <input name="signature" className="w-full rounded border border-slate-300 px-3 py-2" />
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-medium text-slate-700">ID Verified By</span>
            <input name="id_verified_by" className="w-full rounded border border-slate-300 px-3 py-2" />
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-medium text-slate-700">Received By</span>
            <input name="received_by" className="w-full rounded border border-slate-300 px-3 py-2" />
          </label>
        </div>

        <label className="mt-4 block space-y-1 text-sm">
          <span className="font-medium text-slate-700">Notes</span>
          <textarea name="notes" rows={4} placeholder="Condition notes, exceptions, handling notes, or delivery instructions" className="w-full rounded border border-slate-300 px-3 py-2" />
        </label>
      </section>

      <input type="hidden" name="lines_payload" value={linePayload} />

      <div className="flex items-center justify-end">
        <button type="submit" className="rounded bg-cyan-700 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-800">
          Save Manifest
        </button>
      </div>
    </form>
  );
}
