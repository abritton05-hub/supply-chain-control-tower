'use client';

import { useMemo, useState } from 'react';

type MaterialLine = {
  item: string;
  part_number: string;
  description: string;
  qty: string;
  unit: string;
};

const EMPTY_LINE: MaterialLine = {
  item: '',
  part_number: '',
  description: '',
  qty: '',
  unit: '',
};

const DEFAULT_SHIP_FROM = `DENALI (SEA991)\nDenali Advanced Integration\n17735 NE 65th St Ste 110\nRedmond, WA 98052-4924`;

export function BomForm({
  action,
  defaultBomNumber,
  defaultDate,
}: {
  action: (formData: FormData) => void;
  defaultBomNumber?: string;
  defaultDate: string;
}) {
  const [lines, setLines] = useState<MaterialLine[]>(Array.from({ length: 10 }, () => ({ ...EMPTY_LINE })));

  const linePayload = useMemo(() => JSON.stringify(lines), [lines]);

  const updateLine = (lineIndex: number, key: keyof MaterialLine, value: string) => {
    setLines((previous) => previous.map((line, idx) => (idx === lineIndex ? { ...line, [key]: value } : line)));
  };

  return (
    <form action={action} className="space-y-5">
      <section className="erp-card p-4">
        <div className="mb-3 border-b border-slate-200 pb-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">BOM Header</h2>
          <p className="mt-1 text-xs text-slate-500">Capture BOM details, shipping info, and requester details.</p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <label className="space-y-1 text-sm">
            <span className="font-medium text-slate-700">BOM Number</span>
            <input
              name="bom_number"
              defaultValue={defaultBomNumber}
              placeholder="Leave blank to auto-generate"
              className="w-full rounded border border-slate-300 px-3 py-2"
            />
            <span className="block text-xs text-slate-500">Auto-number format: BOM-000001</span>
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-medium text-slate-700">Date</span>
            <input name="date" type="date" defaultValue={defaultDate} className="w-full rounded border border-slate-300 px-3 py-2" required />
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-medium text-slate-700">Project / Job #</span>
            <input name="project_job" placeholder="JOB-24018" className="w-full rounded border border-slate-300 px-3 py-2" />
          </label>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
          <label className="space-y-1 text-sm">
            <span className="font-medium text-slate-700">Requested By</span>
            <input name="requested_by" placeholder="Name" className="w-full rounded border border-slate-300 px-3 py-2" />
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-medium text-slate-700">PO #</span>
            <input name="po_number" placeholder="Purchase order" className="w-full rounded border border-slate-300 px-3 py-2" />
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-medium text-slate-700">Reference #</span>
            <input name="reference_number" placeholder="Customer / internal reference" className="w-full rounded border border-slate-300 px-3 py-2" />
          </label>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <label className="space-y-1 text-sm">
            <span className="font-medium text-slate-700">Ship From</span>
            <textarea name="ship_from" defaultValue={DEFAULT_SHIP_FROM} rows={4} className="w-full rounded border border-slate-300 px-3 py-2" required />
            <span className="block text-xs text-slate-500">Defaulted to SEA991 (Denali Advanced Integration).</span>
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-medium text-slate-700">Ship To</span>
            <textarea name="ship_to" rows={4} placeholder="Customer name\nStreet\nCity, State ZIP" className="w-full rounded border border-slate-300 px-3 py-2" />
          </label>
        </div>
      </section>

      <section className="erp-card overflow-auto">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">Materials</h2>
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
                  <input
                    value={line.description}
                    onChange={(event) => updateLine(index, 'description', event.target.value)}
                    className="w-full rounded border border-slate-300 px-2 py-1"
                  />
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
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <label className="space-y-1 text-sm">
            <span className="font-medium text-slate-700">Notes</span>
            <textarea name="notes" rows={4} placeholder="Special handling, packing, shipping, or build notes" className="w-full rounded border border-slate-300 px-3 py-2" />
          </label>
          <div className="space-y-4">
            <label className="block space-y-1 text-sm">
              <span className="font-medium text-slate-700">Authorized By</span>
              <input name="authorized_by" className="w-full rounded border border-slate-300 px-3 py-2" />
            </label>
            <label className="block space-y-1 text-sm">
              <span className="font-medium text-slate-700">Authorized Date</span>
              <input name="authorized_date" type="date" className="w-full rounded border border-slate-300 px-3 py-2" />
            </label>
          </div>
        </div>
      </section>

      <input type="hidden" name="lines_payload" value={linePayload} />

      <div className="flex items-center justify-end">
        <button type="submit" className="rounded bg-cyan-700 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-800">
          Save BOM
        </button>
      </div>
    </form>
  );
}
