'use client';

import type { ImportPreview, ImportPreviewRow } from '@/lib/import-workflow/types';

type ReviewColumn<TRecord> = {
  key: string;
  label: string;
  render: (record: TRecord, row: ImportPreviewRow<TRecord>) => string | number | null | undefined;
};

type Props<TRecord> = {
  title: string;
  description: string;
  preview: ImportPreview<TRecord>;
  columns: ReviewColumn<TRecord>[];
  isSaving: boolean;
  summaryLabels?: Partial<Record<keyof ImportPreview<TRecord>['summary'], string>>;
  statusLabels?: Partial<Record<ImportPreviewRow<TRecord>['status'], string>>;
  confirmLabel?: string;
  saveDescription?: string;
  isRowSaveable?: (row: ImportPreviewRow<TRecord>) => boolean;
  getRowStatusLabel?: (row: ImportPreviewRow<TRecord>) => string;
  onCancel: () => void;
  onConfirm: () => void;
};

function statusLabel(
  status: ImportPreviewRow<unknown>['status'],
  labels?: Partial<Record<ImportPreviewRow<unknown>['status'], string>>
) {
  if (labels?.[status]) return labels[status];
  if (status === 'insert') return 'New';
  if (status === 'update') return 'Update';
  if (status === 'incomplete') return 'Incomplete';
  return 'Skipped';
}

function statusTone(status: ImportPreviewRow<unknown>['status']) {
  if (status === 'insert') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (status === 'update') return 'border-cyan-200 bg-cyan-50 text-cyan-700';
  if (status === 'incomplete') return 'border-amber-200 bg-amber-50 text-amber-700';
  return 'border-rose-200 bg-rose-50 text-rose-700';
}

export function ImportReviewModal<TRecord>({
  title,
  description,
  preview,
  columns,
  isSaving,
  summaryLabels,
  statusLabels,
  confirmLabel = 'Save Import',
  saveDescription,
  isRowSaveable,
  getRowStatusLabel,
  onCancel,
  onConfirm,
}: Props<TRecord>) {
  const canSaveRow = isRowSaveable ?? ((row: ImportPreviewRow<TRecord>) => row.status !== 'skipped');
  const rowsToSave = preview.rows.filter(canSaveRow).length;
  const visibleRows = preview.rows.slice(0, 100);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
      <div className="max-h-[90vh] w-full max-w-6xl overflow-hidden rounded-lg bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
            <p className="mt-1 text-sm text-slate-500">{description}</p>
          </div>

          <button
            type="button"
            onClick={onCancel}
            className="rounded border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Close
          </button>
        </div>

        <div className="grid gap-3 border-b border-slate-200 bg-slate-50 px-5 py-4 md:grid-cols-5">
          <SummaryTile label={summaryLabels?.newRecords ?? 'New'} value={preview.summary.newRecords} />
          <SummaryTile label={summaryLabels?.updates ?? 'Updates'} value={preview.summary.updates} />
          <SummaryTile
            label={summaryLabels?.incompleteUsable ?? 'Incomplete'}
            value={preview.summary.incompleteUsable}
          />
          <SummaryTile label={summaryLabels?.skippedBlank ?? 'Blank'} value={preview.summary.skippedBlank} />
          <SummaryTile
            label={summaryLabels?.skippedInvalid ?? 'Invalid'}
            value={preview.summary.skippedInvalid}
          />
        </div>

        <div className="max-h-[48vh] overflow-auto">
          <table className="min-w-full text-sm">
            <thead className="sticky top-0 bg-white text-left text-xs font-semibold uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Row</th>
                <th className="px-4 py-3">Result</th>
                {columns.map((column) => (
                  <th key={column.key} className="px-4 py-3">
                    {column.label}
                  </th>
                ))}
                <th className="px-4 py-3">Notes</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row) => (
                <tr key={`${row.rowNumber}-${row.identity}`} className="border-t border-slate-100 align-top">
                  <td className="px-4 py-3 font-medium text-slate-900">{row.rowNumber}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded border px-2 py-1 text-xs font-semibold ${statusTone(row.status)}`}>
                      {getRowStatusLabel?.(row) ?? statusLabel(row.status, statusLabels)}
                    </span>
                  </td>
                  {columns.map((column) => (
                    <td key={column.key} className="max-w-[220px] px-4 py-3 text-slate-700">
                      {column.render(row.record, row) ?? '-'}
                    </td>
                  ))}
                  <td className="max-w-[280px] px-4 py-3 text-slate-600">
                    {row.reasons.length ? row.reasons.join(' ') : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {preview.rows.length > visibleRows.length ? (
            <div className="border-t border-slate-100 px-4 py-3 text-sm text-slate-500">
              Showing the first {visibleRows.length} rows of {preview.rows.length}.
            </div>
          ) : null}
        </div>

        {preview.skipReasons.length ? (
          <div className="border-t border-slate-200 px-5 py-3 text-xs text-rose-700">
            {preview.skipReasons.slice(0, 6).map((reason) => (
              <div key={`${reason.rowNumber}-${reason.reason}`}>
                Row {reason.rowNumber}: {reason.reason}
              </div>
            ))}
          </div>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-5 py-4">
          <p className="text-sm text-slate-500">
            {saveDescription ??
              `${rowsToSave} row${rowsToSave === 1 ? '' : 's'} will be saved. Skipped rows stay out of Supabase.`}
          </p>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="rounded border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={isSaving || rowsToSave === 0}
              className="erp-button"
            >
              {isSaving ? 'Saving...' : confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SummaryTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded border border-slate-200 bg-white px-3 py-2">
      <div className="text-xs font-semibold uppercase text-slate-500">{label}</div>
      <div className="mt-1 text-lg font-semibold text-slate-900">{value}</div>
    </div>
  );
}
