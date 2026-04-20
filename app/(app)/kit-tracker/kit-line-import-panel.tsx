'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ImportReviewModal } from '@/components/import-review-modal';
import { parseExcelFile } from '@/lib/excel-parser';
import type { ImportPreview } from '@/lib/import-workflow/types';
import { parseCsvRows } from '@/lib/import-workflow/parsing';
import { emptyKitLine, parseKitLineRows } from './kit-line-import';
import {
  createKitLineItem,
  importKitLineItems,
  previewKitLineItemsImport,
  updateKitLineItem,
} from './line-item-actions';
import type { KitLineImportInput, KitLineImportResult, KitLineRecord } from './line-item-types';

const PREVIEW_COLUMNS = [
  {
    key: 'kit_name',
    label: 'Kit',
    render: (record: KitLineImportInput) => record.kit_name || '-',
  },
  {
    key: 'part_number',
    label: 'Part Number',
    render: (record: KitLineImportInput) => record.part_number || '-',
  },
  {
    key: 'description',
    label: 'Description',
    render: (record: KitLineImportInput) => record.description || '-',
  },
  {
    key: 'qty_needed',
    label: 'Qty Needed',
    render: (record: KitLineImportInput) => record.qty_needed ?? record.qty_required ?? '-',
  },
  {
    key: 'order_reference',
    label: 'Reference',
    render: (record: KitLineImportInput) => record.order_reference || '-',
  },
  {
    key: 'build_status',
    label: 'Build',
    render: (record: KitLineImportInput) => record.build_status || record.status || '-',
  },
];

type Props = {
  lineItems: KitLineRecord[];
};

function recordToInput(record: KitLineRecord): KitLineImportInput {
  return {
    kit_name: record.kit_name ?? '',
    part_number: record.part_number ?? '',
    description: record.description ?? '',
    rack_type: record.rack_type ?? '',
    vendor: record.vendor ?? '',
    qty_required: record.qty_required,
    qty_on_hand: record.qty_on_hand,
    qty_needed: record.qty_needed,
    included_in_first_5_kits: record.included_in_first_5_kits,
    status: record.status ?? '',
    eta_if_not_included: record.eta_if_not_included ?? '',
    order_reference: record.order_reference ?? '',
    notes: record.notes ?? '',
    risk: record.risk ?? '',
    ready_to_ship: record.ready_to_ship,
    fully_shipped: record.fully_shipped,
    build_status: record.build_status ?? '',
    blocked_reason: record.blocked_reason ?? '',
  };
}

function formatBool(value: boolean | null) {
  if (value === null) return '-';
  return value ? 'Yes' : 'No';
}

function numberValue(value: number | null) {
  return value ?? '';
}

function LineFields({
  value,
  onChange,
}: {
  value: KitLineImportInput;
  onChange: <K extends keyof KitLineImportInput>(key: K, value: KitLineImportInput[K]) => void;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <TextField label="Kit Name" value={value.kit_name} onChange={(next) => onChange('kit_name', next)} />
      <TextField label="Part Number" value={value.part_number} onChange={(next) => onChange('part_number', next)} />
      <TextField label="Description" value={value.description} onChange={(next) => onChange('description', next)} wide />
      <TextField label="Rack Type" value={value.rack_type} onChange={(next) => onChange('rack_type', next)} />
      <TextField label="Vendor" value={value.vendor} onChange={(next) => onChange('vendor', next)} />
      <NumberField label="Qty Required" value={value.qty_required} onChange={(next) => onChange('qty_required', next)} />
      <NumberField label="Qty On Hand" value={value.qty_on_hand} onChange={(next) => onChange('qty_on_hand', next)} />
      <NumberField label="Qty Needed" value={value.qty_needed} onChange={(next) => onChange('qty_needed', next)} />
      <TextField label="Status" value={value.status} onChange={(next) => onChange('status', next)} />
      <TextField label="ETA / If Not Included" value={value.eta_if_not_included} onChange={(next) => onChange('eta_if_not_included', next)} />
      <TextField label="Order Reference" value={value.order_reference} onChange={(next) => onChange('order_reference', next)} />
      <TextField label="Build Status" value={value.build_status} onChange={(next) => onChange('build_status', next)} />
      <TextField label="Blocked Reason" value={value.blocked_reason} onChange={(next) => onChange('blocked_reason', next)} />
      <BoolField label="Ready to Ship" value={value.ready_to_ship} onChange={(next) => onChange('ready_to_ship', next)} />
      <BoolField label="Fully Shipped" value={value.fully_shipped} onChange={(next) => onChange('fully_shipped', next)} />
      <BoolField label="First 5 Kits" value={value.included_in_first_5_kits} onChange={(next) => onChange('included_in_first_5_kits', next)} />
      <TextAreaField label="Notes" value={value.notes} onChange={(next) => onChange('notes', next)} />
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  wide = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  wide?: boolean;
}) {
  return (
    <label className={wide ? 'md:col-span-2' : ''}>
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
      />
    </label>
  );
}

function TextAreaField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="md:col-span-2 xl:col-span-4">
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-[80px] w-full rounded border border-slate-300 px-3 py-2 text-sm"
      />
    </label>
  );
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
}) {
  return (
    <label>
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
      <input
        type="number"
        value={numberValue(value)}
        onChange={(event) => {
          const next = event.target.value;
          onChange(next === '' ? null : Number(next));
        }}
        className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
      />
    </label>
  );
}

function BoolField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean | null;
  onChange: (value: boolean | null) => void;
}) {
  return (
    <label>
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
      <select
        value={value === null ? '' : value ? 'true' : 'false'}
        onChange={(event) => {
          if (!event.target.value) onChange(null);
          else onChange(event.target.value === 'true');
        }}
        className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
      >
        <option value="">Unknown</option>
        <option value="true">Yes</option>
        <option value="false">No</option>
      </select>
    </label>
  );
}

export function KitLineImportPanel({ lineItems }: Props) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [message, setMessage] = useState<KitLineImportResult | null>(null);
  const [pendingRows, setPendingRows] = useState<KitLineImportInput[]>([]);
  const [preview, setPreview] = useState<ImportPreview<KitLineImportInput> | null>(null);
  const [form, setForm] = useState<KitLineImportInput>(() => emptyKitLine(1));
  const [editId, setEditId] = useState('');
  const [editForm, setEditForm] = useState<KitLineImportInput>(() => emptyKitLine(1));
  const [isPending, startTransition] = useTransition();

  async function readFileRows(file: File) {
    const fileName = file.name.toLowerCase();

    if (fileName.endsWith('.xlsx')) {
      return parseExcelFile(file);
    }

    if (fileName.endsWith('.csv')) {
      return parseCsvRows(await file.text());
    }

    throw new Error('Upload a CSV or Excel (.xlsx) readiness file.');
  }

  async function handleFile(file: File | undefined) {
    if (!file) return;

    setMessage(null);
    setPreview(null);
    setPendingRows([]);

    try {
      const rawRows = await readFileRows(file);
      const rows = parseKitLineRows(rawRows);

      if (rows.length === 0) {
        setMessage({
          ok: false,
          message:
            'No readiness rows found. Check for headers like Part Number, Description, Qty Required, Ready to Ship, and Build Status.',
        });
        return;
      }

      startTransition(async () => {
        const result = await previewKitLineItemsImport(rows);

        if (!result.ok || !result.preview) {
          setMessage({
            ok: false,
            message: result.message,
            summary: result.summary
              ? {
                  inserted: result.summary.newRecords,
                  updated: result.summary.updates,
                  incompleteUsable: result.summary.incompleteUsable,
                  skippedBlank: result.summary.skippedBlank,
                  skippedInvalid: result.summary.skippedInvalid,
                  skipReasons:
                    result.preview?.skipReasons
                      .map((reason) => `Row ${reason.rowNumber}: ${reason.reason}`)
                      .slice(0, 5) ?? [],
                }
              : undefined,
          });
          return;
        }

        setPendingRows(rows);
        setPreview(result.preview);
        setMessage({ ok: true, message: result.message });
      });
    } catch (error) {
      setMessage({
        ok: false,
        message: error instanceof Error ? error.message : 'Failed to parse file. Check format.',
      });
    } finally {
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  function savePreview() {
    if (!preview || pendingRows.length === 0) return;

    startTransition(async () => {
      const result = await importKitLineItems(pendingRows);
      setMessage(result);
      setPreview(null);
      setPendingRows([]);

      if (result.ok) {
        router.refresh();
      }
    });
  }

  function updateForm<K extends keyof KitLineImportInput>(
    key: K,
    value: KitLineImportInput[K]
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function updateEditForm<K extends keyof KitLineImportInput>(
    key: K,
    value: KitLineImportInput[K]
  ) {
    setEditForm((prev) => ({ ...prev, [key]: value }));
  }

  function submitManualAdd() {
    setMessage(null);

    startTransition(async () => {
      const result = await createKitLineItem(form);
      setMessage(result);

      if (result.ok) {
        setForm(emptyKitLine(1));
        router.refresh();
      }
    });
  }

  function openEdit(record: KitLineRecord) {
    setEditId(record.id);
    setEditForm(recordToInput(record));
    setMessage(null);
  }

  function submitEdit() {
    if (!editId) return;

    setMessage(null);
    startTransition(async () => {
      const result = await updateKitLineItem(editId, editForm);
      setMessage(result);

      if (result.ok) {
        setEditId('');
        router.refresh();
      }
    });
  }

  return (
    <>
      <div className="erp-panel p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Readiness Line Import</h2>
            <p className="mt-1 text-sm text-slate-500">
              Import BOM/readiness lines into kit line items. Rows are saved only after review.
            </p>
          </div>

          <div>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={isPending}
              className="erp-button"
            >
              {isPending ? 'Reading...' : 'Upload CSV / Excel'}
            </button>
            <input
              ref={inputRef}
              type="file"
              accept=".csv,text/csv,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="hidden"
              onChange={(event) => handleFile(event.target.files?.[0])}
            />
          </div>
        </div>

        <div className="mt-3 rounded border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
          Accepted columns include Part Number, Description, Rack Type, Vendor, Qty Required, Qty On
          Hand, Qty Needed, Included in First 5 Kits, Status, ETA / If Not Included, Order
          Reference, Notes, Risk, Ready to Ship, Fully Shipped, Build Status, and Blocked Reason.
          The first unnamed column can carry the repeated kit name.
        </div>

        {message ? (
          <div className={`mt-3 text-sm font-medium ${message.ok ? 'text-emerald-700' : 'text-rose-700'}`}>
            <p>{message.message}</p>
            {message.summary?.skipReasons.length ? (
              <ul className="mt-1 list-disc pl-5 text-xs">
                {message.summary.skipReasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="erp-panel p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Readiness Line Entry</h2>
            <p className="mt-1 text-sm text-slate-500">
              Add a line directly when paperwork is partial. Missing secondary fields can be
              completed later.
            </p>
          </div>
          <button type="button" onClick={() => setForm(emptyKitLine(1))} className="erp-button">
            Clear Line
          </button>
        </div>

        <div className="mt-4">
          <LineFields value={form} onChange={updateForm} />
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-500">
            Usable identity: part number, description, PO, sales, ticket, ship reference, SHIP-*,
            or S-prefixed identifier.
          </p>
          <button type="button" onClick={submitManualAdd} disabled={isPending} className="erp-button">
            {isPending ? 'Saving...' : 'Add Readiness Line'}
          </button>
        </div>
      </div>

      <div className="erp-panel overflow-hidden">
        <div className="border-b border-slate-200 px-4 py-3">
          <div className="text-sm font-semibold text-slate-900">Readiness Lines</div>
          <div className="text-xs text-slate-500">
            {lineItems.length} imported or manually added kit line item{lineItems.length === 1 ? '' : 's'}.
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Kit</th>
                <th className="px-4 py-3">Part Number</th>
                <th className="px-4 py-3">Description</th>
                <th className="px-4 py-3">Qty Needed</th>
                <th className="px-4 py-3">Reference</th>
                <th className="px-4 py-3">Ready</th>
                <th className="px-4 py-3">Build</th>
                <th className="px-4 py-3">Blocked</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {lineItems.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-slate-500">
                    No readiness lines found.
                  </td>
                </tr>
              ) : (
                lineItems.map((item) => (
                  <tr key={item.id} className="border-b border-slate-100 align-top">
                    <td className="px-4 py-3 text-slate-700">{item.kit_name || '-'}</td>
                    <td className="px-4 py-3 font-medium text-slate-900">{item.part_number || '-'}</td>
                    <td className="max-w-[320px] px-4 py-3 text-slate-700">{item.description || '-'}</td>
                    <td className="px-4 py-3 text-slate-700">
                      {item.qty_needed ?? item.qty_required ?? '-'}
                    </td>
                    <td className="px-4 py-3 text-slate-700">{item.order_reference || '-'}</td>
                    <td className="px-4 py-3 text-slate-700">{formatBool(item.ready_to_ship)}</td>
                    <td className="px-4 py-3 text-slate-700">{item.build_status || item.status || '-'}</td>
                    <td className="px-4 py-3 text-slate-700">{item.blocked_reason || '-'}</td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => openEdit(item)}
                        className="font-semibold text-cyan-700 hover:underline"
                      >
                        Update
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {preview ? (
        <ImportReviewModal
          title="Review Readiness Import"
          description="Incomplete rows are allowed when they have enough identity to clean up later."
          preview={preview}
          columns={PREVIEW_COLUMNS}
          isSaving={isPending}
          onCancel={() => {
            setPreview(null);
            setPendingRows([]);
          }}
          onConfirm={savePreview}
        />
      ) : null}

      {editId ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
          <div className="max-h-[90vh] w-full max-w-6xl overflow-y-auto rounded-lg bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Update Readiness Line</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Clean up incomplete import rows without leaving the kit tracker.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditId('')}
                className="rounded border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Close
              </button>
            </div>

            <div className="px-5 py-4">
              <LineFields value={editForm} onChange={updateEditForm} />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-5 py-4">
              <p className="text-sm text-slate-500">
                Updates keep the same row identity rules as import.
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setEditId('')}
                  className="rounded border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button type="button" onClick={submitEdit} disabled={isPending} className="erp-button">
                  {isPending ? 'Saving...' : 'Update Line'}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
