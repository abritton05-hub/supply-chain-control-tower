'use client';

import { useMemo, useRef, useState } from 'react';
import { SectionHeader } from '@/components/section-header';

type ReceiptRow = {
  id: string;
  receivedAt: string;
  scanValue: string;
  trackingNumber: string;
  partNumber: string;
  description: string;
  quantity: number;
  notes: string;
  receivedBy: string;
  location: string;
};

const starterParts = [
  {
    partNumber: '131950-390',
    description: 'HARNESS AS MOBILE RACK',
  },
  {
    partNumber: '131182-390',
    description: 'HARNESS AS PAA PWR_SW LOAD',
  },
  {
    partNumber: '131184-390',
    description: 'mobile rack to txs1',
  },
  {
    partNumber: '142578-390',
    description: 'mobile rack to txs2,3,4',
  },
  {
    partNumber: '131183-390',
    description: 'mobile rack to rx',
  },
  {
    partNumber: '160225-390',
    description: 'RXS1_S2 MOBILE RACK TO PAA V6',
  },
  {
    partNumber: '131204-390',
    description: 'HARN AS SINGLE RXPA BIST',
  },
  {
    partNumber: '160288-390',
    description: 'SINGLE RXPA V6, BIST PROD',
  },
  {
    partNumber: '150619-203/01',
    description: 'Standoff Pins – RX / TX',
  },
  {
    partNumber: '150619-017/01',
    description: 'Alignment Pins – RX / TX',
  },
  {
    partNumber: '2389296-2',
    description: '0.8 Meter strada to QSFP',
  },
  {
    partNumber: '2389296-1',
    description: '1.5 Meter strada to QSFP',
  },
  {
    partNumber: 'B00B21TLQU',
    description: 'Monitor Mount',
  },
  {
    partNumber: 'B00NH13S44',
    description: 'UTC USB Cable',
  },
  {
    partNumber: 'B0C36GKZ57',
    description: 'Gooseneck stress relief support clamp',
  },
];

const starterReceipts: ReceiptRow[] = [
  {
    id: 'RCV-1001',
    receivedAt: '2026-04-15 08:12',
    scanValue: '131182-390',
    trackingNumber: '1ZTEST0001',
    partNumber: '131182-390',
    description: 'HARNESS AS PAA PWR_SW LOAD',
    quantity: 1,
    notes: 'Initial sample receipt',
    receivedBy: 'Anthony',
    location: 'SEA991',
  },
];

function buildReceiptId(count: number) {
  return `RCV-${String(1000 + count).padStart(4, '0')}`;
}

export default function ReceivingPage() {
  const scanInputRef = useRef<HTMLInputElement | null>(null);

  const [scanValue, setScanValue] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [partNumber, setPartNumber] = useState('');
  const [description, setDescription] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState('');
  const [receivedBy, setReceivedBy] = useState('Anthony');
  const [location, setLocation] = useState('SEA991');
  const [receipts, setReceipts] = useState<ReceiptRow[]>(starterReceipts);

  const matchingParts = useMemo(() => {
    const value = scanValue.trim().toLowerCase();
    if (!value) return starterParts;

    return starterParts.filter(
      (part) =>
        part.partNumber.toLowerCase().includes(value) ||
        part.description.toLowerCase().includes(value)
    );
  }, [scanValue]);

  function applyPart(part: { partNumber: string; description: string }) {
    setPartNumber(part.partNumber);
    setDescription(part.description);
    setScanValue(part.partNumber);
  }

  function handleScanEnter(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter') return;
    e.preventDefault();

    const exactMatch = starterParts.find(
      (part) => part.partNumber.toLowerCase() === scanValue.trim().toLowerCase()
    );

    if (exactMatch) {
      applyPart(exactMatch);
      return;
    }

    if (matchingParts.length === 1) {
      applyPart(matchingParts[0]);
    }
  }

  function clearForm() {
    setScanValue('');
    setTrackingNumber('');
    setPartNumber('');
    setDescription('');
    setQuantity(1);
    setNotes('');
    scanInputRef.current?.focus();
  }

  function saveReceipt() {
    if (!partNumber.trim() && !scanValue.trim()) return;

    const now = new Date();
    const formatted = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
      now.getDate()
    ).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(
      now.getMinutes()
    ).padStart(2, '0')}`;

    const newReceipt: ReceiptRow = {
      id: buildReceiptId(receipts.length + 1),
      receivedAt: formatted,
      scanValue: scanValue.trim(),
      trackingNumber: trackingNumber.trim(),
      partNumber: partNumber.trim() || scanValue.trim(),
      description: description.trim(),
      quantity,
      notes: notes.trim(),
      receivedBy: receivedBy.trim(),
      location: location.trim(),
    };

    setReceipts((prev) => [newReceipt, ...prev]);
    clearForm();
  }

  return (
    <div className="space-y-4">
      <SectionHeader
        title="Receiving"
        subtitle="Scanner-friendly receiving log with traceability-first data entry"
        actions={
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => scanInputRef.current?.focus()}
              className="erp-button"
            >
              Focus Scan Field
            </button>
            <button type="button" onClick={clearForm} className="erp-button">
              Clear Form
            </button>
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="erp-panel p-4 lg:col-span-2">
          <div className="mb-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Scan / Type Part Number
            </div>
            <input
              ref={scanInputRef}
              value={scanValue}
              onChange={(e) => setScanValue(e.target.value)}
              onKeyDown={handleScanEnter}
              placeholder="Scan barcode or type part number"
              className="mt-2 w-full rounded border border-slate-300 px-3 py-3 text-base"
              autoFocus
            />
            <p className="mt-2 text-xs text-slate-500">
              Most scanners act like a keyboard. Scan into this field and press Enter or let the scanner send Enter.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Tracking Number</label>
              <input
                value={trackingNumber}
                onChange={(e) => setTrackingNumber(e.target.value)}
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                placeholder="1Z..., FedEx, DHL, etc."
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Part Number</label>
              <input
                value={partNumber}
                onChange={(e) => setPartNumber(e.target.value)}
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                placeholder="Part number"
              />
            </div>

            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium text-slate-700">Description</label>
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                placeholder="Description"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Quantity</label>
              <input
                type="number"
                min={1}
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value) || 1)}
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Received By</label>
              <input
                value={receivedBy}
                onChange={(e) => setReceivedBy(e.target.value)}
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Location</label>
              <select
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="SEA991">SEA991</option>
                <option value="A13">A13</option>
                <option value="SEA133">SEA133</option>
                <option value="SEA99">SEA99</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium text-slate-700">Notes</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="min-h-[88px] w-full rounded border border-slate-300 px-3 py-2 text-sm"
                placeholder="Condition, packaging, shortage note, damage, calibration, etc."
              />
            </div>
          </div>

          <div className="mt-4 flex justify-end gap-2">
            <button type="button" onClick={clearForm} className="erp-button">
              Reset
            </button>
            <button type="button" onClick={saveReceipt} className="erp-button">
              Save Receipt
            </button>
          </div>
        </div>

        <div className="erp-panel p-4">
          <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Matching Parts
          </div>
          <div className="space-y-2">
            {matchingParts.slice(0, 8).map((part) => (
              <button
                key={part.partNumber}
                type="button"
                onClick={() => applyPart(part)}
                className="block w-full rounded border border-slate-200 px-3 py-2 text-left hover:bg-slate-50"
              >
                <div className="text-sm font-medium text-slate-900">{part.partNumber}</div>
                <div className="text-xs text-slate-500">{part.description}</div>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="erp-panel overflow-hidden">
        <div className="border-b border-slate-200 px-4 py-3">
          <div className="text-sm font-semibold text-slate-900">Receiving Log</div>
          <div className="text-xs text-slate-500">
            Newest receipts first. This is where traceability starts.
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Receipt ID</th>
                <th className="px-4 py-3">Received At</th>
                <th className="px-4 py-3">Tracking</th>
                <th className="px-4 py-3">Part Number</th>
                <th className="px-4 py-3">Description</th>
                <th className="px-4 py-3">Qty</th>
                <th className="px-4 py-3">Location</th>
                <th className="px-4 py-3">Received By</th>
                <th className="px-4 py-3">Notes</th>
              </tr>
            </thead>

            <tbody>
              {receipts.map((row) => (
                <tr key={row.id} className="border-b border-slate-100 align-top">
                  <td className="px-4 py-3 font-medium text-slate-900">{row.id}</td>
                  <td className="px-4 py-3 text-slate-700">{row.receivedAt}</td>
                  <td className="px-4 py-3 text-slate-700">{row.trackingNumber || '-'}</td>
                  <td className="px-4 py-3 text-slate-700">{row.partNumber}</td>
                  <td className="px-4 py-3 text-slate-700">{row.description || '-'}</td>
                  <td className="px-4 py-3 text-slate-700">{row.quantity}</td>
                  <td className="px-4 py-3 text-slate-700">{row.location}</td>
                  <td className="px-4 py-3 text-slate-700">{row.receivedBy}</td>
                  <td className="px-4 py-3 text-slate-700">{row.notes || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}