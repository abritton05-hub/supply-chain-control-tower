'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useFormState, useFormStatus } from 'react-dom';

type MaterialLine = {
  part_number: string;
  description: string;
  qty: string;
  unit: string;
};

const EMPTY_LINE: MaterialLine = {
  part_number: '',
  description: '',
  qty: '',
  unit: '',
};

const DEFAULT_SHIP_FROM = `DENALI (SEA991)
Denali Advanced Integration
17735 NE 65th St Ste 110
Redmond, WA 98052-4924`;

export type BomPrintSaveState = {
  ok: boolean;
  message: string;
  redirectTo?: string;
  errors?: string[];
};

type BomPrintSaveAction = (
  state: BomPrintSaveState,
  formData: FormData
) => Promise<BomPrintSaveState>;

const initialState: BomPrintSaveState = {
  ok: false,
  message: '',
};

function PrintSaveButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded bg-cyan-700 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-800 disabled:cursor-wait disabled:opacity-70"
    >
      {pending ? 'Saving BOM...' : 'Print & Save'}
    </button>
  );
}

function normalizeAddress(value: string) {
  return value
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n')
    .trim();
}

function addressLabel(value: string) {
  const lines = normalizeAddress(value).split('\n').filter(Boolean);
  if (lines.length === 0) return '';
  if (lines.length === 1) return lines[0];
  return `${lines[0]} — ${lines[1]}`;
}

export function BomForm({
  action,
  defaultBomNumber,
  defaultDate,
  savedShipToAddresses = [],
}: {
  action: BomPrintSaveAction;
  defaultBomNumber?: string;
  defaultDate: string;
  savedShipToAddresses?: string[];
}) {
  const router = useRouter();
  const [lines, setLines] = useState<MaterialLine[]>(
    Array.from({ length: 10 }, () => ({ ...EMPTY_LINE }))
  );
  const [state, formAction] = useFormState(action, initialState);

  const [shipFrom, setShipFrom] = useState(DEFAULT_SHIP_FROM);
  const [shipTo, setShipTo] = useState('');
  const [selectedSavedShipTo, setSelectedSavedShipTo] = useState('');

  const linePayload = useMemo(() => JSON.stringify(lines), [lines]);

  useEffect(() => {
    if (state.ok && state.redirectTo) {
      router.push(state.redirectTo);
    }
  }, [router, state.ok, state.redirectTo]);

  const updateLine = (lineIndex: number, key: keyof MaterialLine, value: string) => {
    setLines((previous) =>
      previous.map((line, idx) => (idx === lineIndex ? { ...line, [key]: value } : line))
    );
  };

  function swapAddresses() {
    setShipFrom(shipTo);
    setShipTo(shipFrom);
    setSelectedSavedShipTo('');
  }

  function handleSavedAddressSelect(value: string) {
    setSelectedSavedShipTo(value);
    if (!value) return;
    setShipTo(value);
  }

  return (
    <form action={formAction} className="space-y-5">
      <section className="erp-card p-4">
        <div className="mb-3 border-b border-slate-200 pb-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">
            BOM Header
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Capture BOM details, shipping info, and requester details.
          </p>
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
            <span className="block text-xs text-slate-500">
              Auto-number format: BOM-000001
            </span>
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-medium text-slate-700">Date</span>
            <input
              name="date"
              type="date"
              defaultValue={defaultDate}
              className="w-full rounded border border-slate-300 px-3 py-2"
              required
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-medium text-slate-700">Project / Job #</span>
            <input
              name="project_job"
              placeholder="JOB-24018"
              className="w-full rounded border border-slate-300 px-3 py-2"
            />
          </label>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
          <label className="space-y-1 text-sm">
            <span className="font-medium text-slate-700">Requested By</span>
            <input
              name="requested_by"
              placeholder="Name"
              className="w-full rounded border border-slate-300 px-3 py-2"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-medium text-slate-700">PO #</span>
            <input
              name="po_number"
              placeholder="Purchase order"
              className="w-full rounded border border-slate-300 px-3 py-2"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-medium text-slate-700">Reference #</span>
            <input
              name="reference_number"
              placeholder="Customer / internal reference"
              className="w-full rounded border border-slate-300 px-3 py-2"
            />
          </label>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-[1fr_auto_1fr]">
          <label className="space-y-1 text-sm">
            <span className="font-medium text-slate-700">Ship From</span>
            <textarea
              name="ship_from"
              value={shipFrom}
              onChange={(event) => setShipFrom(event.target.value)}
              rows={4}
              className="w-full rounded border border-slate-300 px-3 py-2"
              required
            />
            <span className="block text-xs text-slate-500">
              Defaulted to SEA991 (Denali Advanced Integration).
            </span>
          </label>

          <div className="flex items-center justify-center pt-6 md:pt-0">
            <button
              type="button"
              onClick={swapAddresses}
              className="rounded border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              title="Swap Ship From and Ship To"
            >
              ⇄ Swap
            </button>
          </div>

          <div className="space-y-1 text-sm">
            <span className="font-medium text-slate-700">Ship To</span>

            <select
              value={selectedSavedShipTo}
              onChange={(event) => handleSavedAddressSelect(event.target.value)}
              className="w-full rounded border border-slate-300 px-3 py-2"
            >
              <option value="">Saved addresses</option>
              {savedShipToAddresses.map((address) => (
                <option key={address} value={address}>
                  {addressLabel(address)}
                </option>
              ))}
            </select>

            <textarea
              name="ship_to"
              value={shipTo}
              onChange={(event) => {
                setShipTo(event.target.value);
                setSelectedSavedShipTo('');
              }}
              rows={4}
              placeholder="Customer name
Street
City, State ZIP"
              className="w-full rounded border border-slate-300 px-3 py-2"
            />

            <span className="block text-xs text-slate-500">
              Saved addresses come from previously saved BOM destinations across the system.
            </span>
          </div>
        </div>
      </section>

      <section className="erp-card overflow-auto">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">
              Materials
            </h2>
            <p className="text-xs text-slate-500">
              10 blank rows are ready. Fully blank rows are ignored on save.
            </p>
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
              <th className="w-[8%]">#</th>
              <th className="w-[28%]">Part Number</th>
              <th className="w-[44%]">Description</th>
              <th className="w-[10%]">Qty</th>
              <th className="w-[10%]">Unit</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line, index) => (
              <tr key={index}>
                <td className="text-center text-xs font-semibold text-slate-500">{index + 1}</td>
                <td>
                  <input
                    value={line.part_number}
                    onChange={(event) => updateLine(index, 'part_number', event.target.value)}
                    className="w-full rounded border border-slate-300 px-2 py-1"
                  />
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
                  <input
                    value={line.unit}
                    onChange={(event) => updateLine(index, 'unit', event.target.value)}
                    className="w-full rounded border border-slate-300 px-2 py-1"
                    placeholder="EA"
                  />
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
            <textarea
              name="notes"
              rows={4}
              placeholder="Special handling, packing, shipping, or build notes"
              className="w-full rounded border border-slate-300 px-3 py-2"
            />
          </label>
          <div className="space-y-4">
            <label className="block space-y-1 text-sm">
              <span className="font-medium text-slate-700">Authorized By</span>
              <input
                name="authorized_by"
                className="w-full rounded border border-slate-300 px-3 py-2"
              />
            </label>
            <label className="block space-y-1 text-sm">
              <span className="font-medium text-slate-700">Authorized Date</span>
              <input
                name="authorized_date"
                type="date"
                className="w-full rounded border border-slate-300 px-3 py-2"
              />
            </label>
          </div>
        </div>
      </section>

      <input type="hidden" name="lines_payload" value={linePayload} />

      {state.message ? (
        <section
          className={`rounded border px-4 py-3 text-sm ${
            state.ok
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
              : 'border-rose-200 bg-rose-50 text-rose-700'
          }`}
          aria-live="polite"
        >
          <p className="font-semibold">{state.message}</p>
          {state.errors && state.errors.length > 0 ? (
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {state.errors.map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          ) : null}
          {!state.ok && state.redirectTo ? (
            <a href={state.redirectTo} className="mt-3 inline-block font-semibold underline">
              Open saved BOM
            </a>
          ) : null}
        </section>
      ) : null}

      <div className="flex items-center justify-end">
        <PrintSaveButton />
      </div>
    </form>
  );
}