'use client';

import { useMemo, useState } from 'react';
import type { DeliveryPageData } from './types';

type DeliveryClientProps = DeliveryPageData & {
  canManageDelivery: boolean;
};

type LineItem = {
  id: string;
  qty: string;
  partNumber: string;
  description: string;
  boxes: string;
};

type DropOff = {
  id: string;
  date: string;
  po: string;
  fromLocation: string;
  toLocation: string;
  customer: string;
  notes: string;
  lines: LineItem[];
};

const DEFAULT_FROM = 'SEA991';
const LOCATION_OPTIONS = ['SEA991', 'SEA133', 'WH/A13', 'Customer Site', 'Other'];

function today() {
  return new Date().toISOString().slice(0, 10);
}

function newId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function blankLine(): LineItem {
  return {
    id: newId('line'),
    qty: '1',
    partNumber: '',
    description: '',
    boxes: '1',
  };
}

function blankDropOff(): DropOff {
  return {
    id: newId('dropoff'),
    date: today(),
    po: '',
    fromLocation: DEFAULT_FROM,
    toLocation: '',
    customer: '',
    notes: '',
    lines: [blankLine()],
  };
}

function toNumber(value: string) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function totalBoxes(lines: LineItem[]) {
  return lines.reduce((sum, line) => sum + toNumber(line.boxes), 0);
}

function totalQty(lines: LineItem[]) {
  return lines.reduce((sum, line) => sum + toNumber(line.qty), 0);
}

function PackingSlip({ dropOff }: { dropOff: DropOff }) {
  return (
    <div className="hidden print:block">
      <div className="mx-auto max-w-5xl p-8 text-slate-950">
        <div className="border-b-2 border-slate-950 pb-4">
          <h1 className="text-3xl font-black uppercase tracking-wide">Packing Slip</h1>
          <p className="mt-1 text-sm font-bold uppercase tracking-wide text-slate-600">Customer Copy</p>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-4 text-sm">
          <div className="rounded-lg border border-slate-400 p-3">
            <div className="text-xs font-black uppercase tracking-wide text-slate-500">PO / Reference</div>
            <div className="mt-1 font-bold">{dropOff.po || '-'}</div>
          </div>
          <div className="rounded-lg border border-slate-400 p-3">
            <div className="text-xs font-black uppercase tracking-wide text-slate-500">Customer / Receiver</div>
            <div className="mt-1 font-bold">{dropOff.customer || '-'}</div>
          </div>
          <div className="rounded-lg border border-slate-400 p-3">
            <div className="text-xs font-black uppercase tracking-wide text-slate-500">Ship From</div>
            <div className="mt-1 font-bold">{dropOff.fromLocation || '-'}</div>
          </div>
          <div className="rounded-lg border border-slate-400 p-3">
            <div className="text-xs font-black uppercase tracking-wide text-slate-500">Ship To</div>
            <div className="mt-1 font-bold">{dropOff.toLocation || '-'}</div>
          </div>
        </div>

        <table className="mt-6 w-full border-collapse text-sm">
          <thead>
            <tr className="bg-slate-100">
              <th className="border border-slate-400 p-2 text-left">Line</th>
              <th className="border border-slate-400 p-2 text-left">Qty</th>
              <th className="border border-slate-400 p-2 text-left">Part Number</th>
              <th className="border border-slate-400 p-2 text-left">Description</th>
              <th className="border border-slate-400 p-2 text-left">Boxes</th>
            </tr>
          </thead>
          <tbody>
            {dropOff.lines.map((line, index) => (
              <tr key={line.id}>
                <td className="border border-slate-400 p-2">{index + 1}</td>
                <td className="border border-slate-400 p-2">{line.qty || '-'}</td>
                <td className="border border-slate-400 p-2">{line.partNumber || '-'}</td>
                <td className="border border-slate-400 p-2">{line.description || '-'}</td>
                <td className="border border-slate-400 p-2">{line.boxes || '0'}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {dropOff.notes ? (
          <div className="mt-6 rounded-lg border border-slate-400 p-3 text-sm">
            <div className="text-xs font-black uppercase tracking-wide text-slate-500">Notes</div>
            <div className="mt-1 whitespace-pre-wrap">{dropOff.notes}</div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function DeliveryClient({ canManageDelivery }: DeliveryClientProps) {
  const [dropOff, setDropOff] = useState<DropOff>(() => blankDropOff());
  const [message, setMessage] = useState('Packing slip ready for drop offs. Fill it out, then print.');

  const boxCount = useMemo(() => totalBoxes(dropOff.lines), [dropOff.lines]);
  const qtyCount = useMemo(() => totalQty(dropOff.lines), [dropOff.lines]);

  function update(field: keyof DropOff, value: string) {
    setDropOff((current) => ({ ...current, [field]: value }));
  }

  function updateLine(index: number, field: keyof LineItem, value: string) {
    setDropOff((current) => ({
      ...current,
      lines: current.lines.map((line, lineIndex) =>
        lineIndex === index ? { ...line, [field]: value } : line
      ),
    }));
  }

  function addLine() {
    setDropOff((current) => ({ ...current, lines: [...current.lines, blankLine()] }));
  }

  function removeLine(index: number) {
    setDropOff((current) => ({
      ...current,
      lines: current.lines.length > 1 ? current.lines.filter((_, lineIndex) => lineIndex !== index) : current.lines,
    }));
  }

  function resetForm() {
    setDropOff(blankDropOff());
    setMessage('New drop off packing slip started.');
  }

  function printPackingSlip() {
    setMessage('Printing packing slip.');
    window.setTimeout(() => window.print(), 50);
  }

  if (!canManageDelivery) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-black text-slate-950">Shipping & Delivery</h2>
        <p className="mt-2 text-sm font-semibold text-slate-600">You do not have permission to manage delivery records.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm print:hidden">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h2 className="text-lg font-black text-slate-950">Drop Off Packing Slip</h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">Customer packing slip only. No signature block. No date field on the printed slip.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={resetForm} className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-black text-slate-700 hover:bg-slate-50">New Slip</button>
            <button type="button" onClick={printPackingSlip} className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-black text-white hover:bg-slate-800">Print Packing Slip</button>
          </div>
        </div>

        {message ? (
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700">{message}</div>
        ) : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-4 print:hidden">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Total Qty</div>
          <div className="mt-2 text-2xl font-black text-slate-950">{qtyCount}</div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Box Count</div>
          <div className="mt-2 text-2xl font-black text-slate-950">{boxCount}</div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:col-span-2">
          <label className="text-sm font-bold text-slate-700">PO / Reference
            <input value={dropOff.po} onChange={(event) => update('po', event.target.value)} className="mt-1 h-11 w-full rounded-xl border border-slate-300 px-3 text-sm font-semibold" />
          </label>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm print:hidden">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="text-sm font-bold text-slate-700">Ship From
            <select value={dropOff.fromLocation} onChange={(event) => update('fromLocation', event.target.value)} className="mt-1 h-11 w-full rounded-xl border border-slate-300 px-3 text-sm font-semibold">
              <option value="">Select location</option>
              {LOCATION_OPTIONS.map((location) => <option key={location} value={location}>{location}</option>)}
            </select>
          </label>
          <label className="text-sm font-bold text-slate-700">Ship To
            <select value={dropOff.toLocation} onChange={(event) => update('toLocation', event.target.value)} className="mt-1 h-11 w-full rounded-xl border border-slate-300 px-3 text-sm font-semibold">
              <option value="">Select location</option>
              {LOCATION_OPTIONS.map((location) => <option key={location} value={location}>{location}</option>)}
            </select>
          </label>
          <label className="text-sm font-bold text-slate-700 md:col-span-2">Customer / Receiver
            <input value={dropOff.customer} onChange={(event) => update('customer', event.target.value)} className="mt-1 h-11 w-full rounded-xl border border-slate-300 px-3 text-sm font-semibold" />
          </label>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm print:hidden">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 pb-3">
          <div>
            <h3 className="text-base font-black text-slate-950">Item Lines</h3>
            <p className="text-xs font-semibold text-slate-500">Box count above totals the Boxes column.</p>
          </div>
          <button type="button" onClick={addLine} className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-black text-slate-700 hover:bg-slate-50">Add Line</button>
        </div>

        <div className="mt-4 overflow-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-black uppercase tracking-[0.12em] text-slate-500">
              <tr>
                <th className="px-3 py-3">Qty</th>
                <th className="px-3 py-3">Part #</th>
                <th className="px-3 py-3">Description</th>
                <th className="px-3 py-3">Boxes</th>
                <th className="px-3 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {dropOff.lines.map((line, index) => (
                <tr key={line.id}>
                  <td className="px-3 py-2"><input type="number" min="1" value={line.qty} onChange={(event) => updateLine(index, 'qty', event.target.value)} className="h-10 w-24 rounded-lg border border-slate-300 px-2 font-semibold" /></td>
                  <td className="px-3 py-2"><input value={line.partNumber} onChange={(event) => updateLine(index, 'partNumber', event.target.value)} className="h-10 w-44 rounded-lg border border-slate-300 px-2 font-semibold" /></td>
                  <td className="px-3 py-2"><input value={line.description} onChange={(event) => updateLine(index, 'description', event.target.value)} className="h-10 w-full min-w-64 rounded-lg border border-slate-300 px-2 font-semibold" /></td>
                  <td className="px-3 py-2"><input type="number" min="0" value={line.boxes} onChange={(event) => updateLine(index, 'boxes', event.target.value)} className="h-10 w-24 rounded-lg border border-slate-300 px-2 font-semibold" /></td>
                  <td className="px-3 py-2 text-right"><button type="button" onClick={() => removeLine(index)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-black text-rose-700 hover:bg-slate-50">Remove</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <label className="mt-4 block text-sm font-bold text-slate-700">Notes
          <textarea value={dropOff.notes} onChange={(event) => update('notes', event.target.value)} className="mt-1 min-h-24 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold" />
        </label>
      </div>

      <PackingSlip dropOff={dropOff} />
    </div>
  );
}
