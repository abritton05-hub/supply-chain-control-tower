'use client';

import { useEffect, useMemo, useState } from 'react';
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

type DeliveryReceipt = DropOff & {
  receiptNumber: string;
  createdAt: string;
};

const DEFAULT_FROM = 'SEA991';
const LOCATION_OPTIONS = ['SEA991', 'SEA133', 'WH/A13', 'Customer Site', 'Other'];
const RECEIPT_STORAGE_KEY = 'scct.delivery.receipts.v1';

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

function createReceiptNumber(existingReceipts: DeliveryReceipt[]) {
  const next = existingReceipts.length + 1;
  return `DAI-DR-${String(next).padStart(5, '0')}`;
}

function loadReceipts() {
  if (typeof window === 'undefined') return [] as DeliveryReceipt[];

  try {
    const raw = window.localStorage.getItem(RECEIPT_STORAGE_KEY);
    if (!raw) return [] as DeliveryReceipt[];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as DeliveryReceipt[]) : [];
  } catch {
    return [] as DeliveryReceipt[];
  }
}

function saveReceipts(receipts: DeliveryReceipt[]) {
  window.localStorage.setItem(RECEIPT_STORAGE_KEY, JSON.stringify(receipts));
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
          <PrintMeta label="PO / Reference" value={dropOff.po} />
          <PrintMeta label="Customer / Receiver" value={dropOff.customer} />
          <PrintMeta label="Ship From" value={dropOff.fromLocation} />
          <PrintMeta label="Ship To" value={dropOff.toLocation} />
        </div>

        <LinePrintTable lines={dropOff.lines} />

        {dropOff.notes ? <PrintNotes notes={dropOff.notes} /> : null}
      </div>
    </div>
  );
}

function DeliveryReceiptPrint({ receipt }: { receipt: DeliveryReceipt }) {
  return (
    <div className="hidden print:block">
      <div className="mx-auto max-w-5xl p-8 text-slate-950">
        <div className="border-b-2 border-slate-950 pb-4">
          <h1 className="text-3xl font-black uppercase tracking-wide">Delivery Receipt</h1>
          <p className="mt-1 text-sm font-bold uppercase tracking-wide text-slate-600">Receipt #: {receipt.receiptNumber}</p>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-4 text-sm">
          <PrintMeta label="PO / Reference" value={receipt.po} />
          <PrintMeta label="Customer / Receiver" value={receipt.customer} />
          <PrintMeta label="Ship From" value={receipt.fromLocation} />
          <PrintMeta label="Ship To" value={receipt.toLocation} />
          <PrintMeta label="Created" value={new Date(receipt.createdAt).toLocaleString()} />
          <PrintMeta label="Boxes" value={String(totalBoxes(receipt.lines))} />
        </div>

        <LinePrintTable lines={receipt.lines} />

        {receipt.notes ? <PrintNotes notes={receipt.notes} /> : null}

        <div className="mt-10 grid grid-cols-2 gap-10 text-sm">
          <div>
            <div className="font-bold">Received By</div>
            <div className="mt-8 border-b border-slate-950" />
          </div>
          <div>
            <div className="font-bold">Signature</div>
            <div className="mt-8 border-b border-slate-950" />
          </div>
        </div>
      </div>
    </div>
  );
}

function PrintMeta({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-400 p-3">
      <div className="text-xs font-black uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 font-bold">{value || '-'}</div>
    </div>
  );
}

function PrintNotes({ notes }: { notes: string }) {
  return (
    <div className="mt-6 rounded-lg border border-slate-400 p-3 text-sm">
      <div className="text-xs font-black uppercase tracking-wide text-slate-500">Notes</div>
      <div className="mt-1 whitespace-pre-wrap">{notes}</div>
    </div>
  );
}

function LinePrintTable({ lines }: { lines: LineItem[] }) {
  return (
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
        {lines.map((line, index) => (
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
  );
}

export function DeliveryClient({ canManageDelivery }: DeliveryClientProps) {
  const [dropOff, setDropOff] = useState<DropOff>(() => blankDropOff());
  const [receipts, setReceipts] = useState<DeliveryReceipt[]>([]);
  const [selectedReceipt, setSelectedReceipt] = useState<DeliveryReceipt | null>(null);
  const [printMode, setPrintMode] = useState<'packing-slip' | 'delivery-receipt' | null>(null);
  const [message, setMessage] = useState('Packing slip and delivery receipt are ready for drop offs.');

  useEffect(() => {
    setReceipts(loadReceipts());
  }, []);

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
    setSelectedReceipt(null);
    setPrintMode(null);
    setMessage('New drop off started.');
  }

  function createDeliveryReceipt() {
    const receipt: DeliveryReceipt = {
      ...dropOff,
      id: newId('receipt-source'),
      receiptNumber: createReceiptNumber(receipts),
      createdAt: new Date().toISOString(),
      lines: dropOff.lines.map((line) => ({ ...line })),
    };

    const nextReceipts = [receipt, ...receipts];
    setReceipts(nextReceipts);
    saveReceipts(nextReceipts);
    setSelectedReceipt(receipt);
    setMessage(`Delivery receipt ${receipt.receiptNumber} created and saved in receipt history.`);
  }

  function openReceipt(receipt: DeliveryReceipt) {
    setSelectedReceipt(receipt);
    setMessage(`Opened delivery receipt ${receipt.receiptNumber}.`);
  }

  function deleteReceipt(receipt: DeliveryReceipt) {
    if (!window.confirm(`Delete delivery receipt ${receipt.receiptNumber}?`)) return;

    const nextReceipts = receipts.filter((item) => item.receiptNumber !== receipt.receiptNumber);
    setReceipts(nextReceipts);
    saveReceipts(nextReceipts);
    setSelectedReceipt(null);
    setMessage(`Delivery receipt ${receipt.receiptNumber} deleted.`);
  }

  function printPackingSlip() {
    setPrintMode('packing-slip');
    window.setTimeout(() => window.print(), 50);
  }

  function printDeliveryReceipt(receipt = selectedReceipt) {
    if (!receipt) {
      setMessage('Create or open a delivery receipt before printing it.');
      return;
    }

    setSelectedReceipt(receipt);
    setPrintMode('delivery-receipt');
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
            <h2 className="text-lg font-black text-slate-950">Drop Off Documents</h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">Create customer packing slips and saved delivery receipts for drop offs.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={resetForm} className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-black text-slate-700 hover:bg-slate-50">New Drop Off</button>
            <button type="button" onClick={printPackingSlip} className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-black text-slate-700 hover:bg-slate-50">Print Packing Slip</button>
            <button type="button" onClick={createDeliveryReceipt} className="rounded-xl bg-cyan-700 px-4 py-2 text-sm font-black text-white hover:bg-cyan-800">Create Delivery Receipt</button>
            <button type="button" onClick={() => printDeliveryReceipt()} className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-black text-white hover:bg-slate-800">Print Delivery Receipt</button>
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

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm print:hidden">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h3 className="text-base font-black text-slate-950">Delivery Receipt History</h3>
            <p className="text-xs font-semibold text-slate-500">Receipts created on this device are saved here.</p>
          </div>
          <div className="text-sm font-black text-slate-700">{receipts.length} saved</div>
        </div>

        <div className="mt-4 overflow-auto rounded-xl border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-black uppercase tracking-[0.12em] text-slate-500">
              <tr>
                <th className="px-3 py-3">Receipt #</th>
                <th className="px-3 py-3">PO / Ref</th>
                <th className="px-3 py-3">Ship To</th>
                <th className="px-3 py-3">Qty</th>
                <th className="px-3 py-3">Boxes</th>
                <th className="px-3 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {receipts.length ? receipts.map((receipt) => (
                <tr key={receipt.receiptNumber} className="hover:bg-slate-50">
                  <td className="px-3 py-3 font-black text-slate-950">{receipt.receiptNumber}</td>
                  <td className="px-3 py-3">{receipt.po || '-'}</td>
                  <td className="px-3 py-3">{receipt.toLocation || '-'}</td>
                  <td className="px-3 py-3">{totalQty(receipt.lines)}</td>
                  <td className="px-3 py-3">{totalBoxes(receipt.lines)}</td>
                  <td className="px-3 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <button type="button" onClick={() => openReceipt(receipt)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-black text-slate-700 hover:bg-slate-50">Open</button>
                      <button type="button" onClick={() => printDeliveryReceipt(receipt)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-black text-slate-700 hover:bg-slate-50">Print</button>
                      <button type="button" onClick={() => deleteReceipt(receipt)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-black text-rose-700 hover:bg-slate-50">Delete</button>
                    </div>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-sm font-semibold text-slate-500">No delivery receipts created yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {printMode === 'packing-slip' ? <PackingSlip dropOff={dropOff} /> : null}
      {printMode === 'delivery-receipt' && selectedReceipt ? <DeliveryReceiptPrint receipt={selectedReceipt} /> : null}
    </div>
  );
}
