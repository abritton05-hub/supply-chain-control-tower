'use client';

import { ChangeEvent, useEffect, useMemo, useState } from 'react';
import { DataTable } from '@/components/data-table';
import { SectionHeader } from '@/components/section-header';
import { importActorName, importTargets, ImportTarget, mapRows, parseDelimitedText, validateMappedRows, commitImport } from '@/lib/imports/import-config';
import { useImportHistoryStore } from '@/lib/state/mock-client-db';

export default function ImportsPage() {
  const [target, setTarget] = useState<ImportTarget>('Users');
  const [sourceName, setSourceName] = useState('pasted-data.csv');
  const [rawInput, setRawInput] = useState('Full Name,Email,Role,Department,Status\nJamie Flynn,jflynn@example.com,Warehouse,Warehouse,Active');
  const [fieldMap, setFieldMap] = useState<Record<string, string>>({});
  const [history, setHistory] = useImportHistoryStore();
  const [fileWarning, setFileWarning] = useState('');

  const config = useMemo(() => importTargets.find((entry) => entry.value === target)!, [target]);
  const parsed = useMemo(() => parseDelimitedText(rawInput), [rawInput]);
  const mapped = useMemo(() => mapRows(parsed.rows, fieldMap), [fieldMap, parsed.rows]);
  const validation = useMemo(() => validateMappedRows(target, mapped), [mapped, target]);

  useEffect(() => {
    if (!parsed.headers.length) return;
    setFieldMap(parsed.headers.reduce<Record<string, string>>((acc, header) => {
      const normalized = header.toLowerCase().replace(/[^a-z0-9]+/g, '');
      const aliases: Record<string, string> = { fullname: 'name', username: 'name', vendorname: 'vendorName', contactperson: 'contact', projectid: 'projectId', customername: 'customerName', itemname: 'itemName', itemid: 'itemId', ponumber: 'poNumber', serialnumber: 'serialNumber' };
      const match = config.fields.find((field) => field.toLowerCase().replace(/[^a-z0-9]+/g, '') === normalized) ?? aliases[normalized];
      acc[header] = match ?? '__ignore__';
      return acc;
    }, {}));
  }, [config.fields, parsed.headers]);

  const onFileUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setSourceName(file.name);
    if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
      setFileWarning('Excel upload is structure-ready in this mock ERP utility, but browser-side XLSX parsing is deferred. Please paste rows or upload CSV for preview/validation today.');
      return;
    }
    setFileWarning('');
    const text = await file.text();
    setRawInput(text);
  };

  const confirmImport = () => {
    const rowsImported = validation.errors.length ? 0 : commitImport(target, mapped);
    setHistory((prev) => [{ id: `import-${Date.now()}`, createdAt: new Date().toISOString(), target, fileName: sourceName, rowsImported, rowsRejected: validation.errors.length ? mapped.length : 0, importedBy: importActorName, status: validation.errors.length ? 'Validation blocked' : validation.warnings.length ? 'Completed with warnings' : 'Completed', notes: validation.errors[0] ?? validation.warnings[0] }, ...prev]);
  };

  return (
    <div className="space-y-3">
      <SectionHeader title="Imports / Migration" subtitle="ERP list ingestion, field mapping, validation, preview, and local mock commit pipeline" />

      <div className="erp-card p-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">Import Target</label>
            <select value={target} onChange={(event) => setTarget(event.target.value as ImportTarget)} className="w-full rounded border border-slate-300 px-2 py-1 text-sm">{importTargets.map((entry) => <option key={entry.value}>{entry.value}</option>)}</select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">Upload File</label>
            <input type="file" accept=".csv,.txt,.xls,.xlsx" onChange={onFileUpload} className="w-full rounded border border-slate-300 px-2 py-1 text-sm" />
          </div>
          <div className="xl:col-span-2">
            <label className="mb-1 block text-xs font-semibold text-slate-600">Paste Data</label>
            <textarea value={rawInput} onChange={(event) => setRawInput(event.target.value)} className="h-24 w-full rounded border border-slate-300 px-2 py-1 text-xs" />
          </div>
        </div>
        {fileWarning && <p className="mt-2 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">{fileWarning}</p>}
      </div>

      <div className="grid gap-3 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="erp-card p-4">
          <h3 className="text-sm font-semibold">Field Mapping</h3>
          <p className="mt-1 text-xs text-slate-500">Match incoming columns to ERP fields before commit.</p>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {parsed.headers.map((header) => (
              <label key={header} className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
                <span className="mb-1 block font-semibold">{header}</span>
                <select value={fieldMap[header] ?? '__ignore__'} onChange={(event) => setFieldMap((prev) => ({ ...prev, [header]: event.target.value }))} className="w-full rounded border border-slate-300 px-2 py-1 text-xs">
                  <option value="__ignore__">Ignore column</option>
                  {config.fields.map((field) => <option key={field} value={field}>{field}</option>)}
                </select>
              </label>
            ))}
          </div>
        </div>

        <div className="erp-card p-4">
          <h3 className="text-sm font-semibold">Validation / Error Panel</h3>
          <div className="mt-3 grid gap-2 text-xs md:grid-cols-2 xl:grid-cols-1">
            <div className="rounded border border-slate-200 bg-slate-50 px-3 py-2">Rows Parsed: <span className="font-semibold">{parsed.rows.length}</span></div>
            <div className="rounded border border-slate-200 bg-slate-50 px-3 py-2">Valid Rows: <span className="font-semibold">{Math.max(0, mapped.length - validation.errors.length)}</span></div>
            <div className="rounded border border-slate-200 bg-slate-50 px-3 py-2">Warnings: <span className="font-semibold">{validation.warnings.length}</span></div>
            <div className="rounded border border-slate-200 bg-slate-50 px-3 py-2">Errors: <span className="font-semibold">{validation.errors.length}</span></div>
          </div>
          <div className="mt-3 space-y-2 text-xs">
            {validation.errors.map((error) => <p key={error} className="rounded border border-rose-200 bg-rose-50 px-3 py-2 text-rose-700">{error}</p>)}
            {validation.warnings.map((warning) => <p key={warning} className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-amber-800">{warning}</p>)}
            {!validation.errors.length && !validation.warnings.length && <p className="rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-700">Preview validated with no issues.</p>}
          </div>
          <div className="mt-4 flex gap-2">
            <button onClick={confirmImport} className="rounded border border-cyan-700 bg-cyan-50 px-3 py-1 text-xs text-cyan-800">Confirm Import</button>
          </div>
        </div>
      </div>

      <div className="erp-card p-4">
        <h3 className="text-sm font-semibold">Import Preview</h3>
        <DataTable>
          <thead><tr>{config.fields.map((field) => <th key={field}>{field}</th>)}</tr></thead>
          <tbody>{mapped.map((row, index) => <tr key={index}>{config.fields.map((field) => <td key={field}>{row[field] ?? '-'}</td>)}</tr>)}</tbody>
        </DataTable>
      </div>

      <div className="erp-card p-4">
        <h3 className="text-sm font-semibold">Import History</h3>
        <DataTable>
          <thead><tr>{['Date/Time', 'Target', 'File Name', 'Rows Imported', 'Rows Rejected', 'Imported By', 'Status', 'Notes'].map((heading) => <th key={heading}>{heading}</th>)}</tr></thead>
          <tbody>{history.map((entry) => <tr key={entry.id}><td>{entry.createdAt}</td><td>{entry.target}</td><td>{entry.fileName}</td><td>{entry.rowsImported}</td><td>{entry.rowsRejected}</td><td>{entry.importedBy}</td><td>{entry.status}</td><td>{entry.notes ?? '-'}</td></tr>)}</tbody>
        </DataTable>
      </div>
    </div>
  );
}
