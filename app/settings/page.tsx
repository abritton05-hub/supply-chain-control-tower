<<<<<<< HEAD
'use client';

import { useState } from 'react';
import { ModulePageShell } from '@/components/module-page-shell';

export default function SettingsPage() {
  const [prefix, setPrefix] = useState('DAI');
  const [separator, setSeparator] = useState('-');
  const [startingNumber, setStartingNumber] = useState('00001');
  const [paddingLength, setPaddingLength] = useState(5);
  const [autoGenerateOnReceive, setAutoGenerateOnReceive] = useState(true);
  const [allowManualOverride, setAllowManualOverride] = useState(true);
  const [requireUniqueness, setRequireUniqueness] = useState(true);

  return (
    <ModulePageShell title="Settings" subtitle="System configuration, imports, and serial numbering controls">
      <div className="grid gap-4 lg:grid-cols-2">
        <article className="erp-card p-4">
          <h3 className="text-sm font-semibold text-slate-800">Serial Numbering</h3>
          <div className="mt-3 grid gap-3 text-sm">
            <label>Company Prefix <input className="mt-1 w-full rounded border border-slate-300 px-2 py-1" value={prefix} onChange={(e) => setPrefix(e.target.value)} /></label>
            <label>Separator <input className="mt-1 w-full rounded border border-slate-300 px-2 py-1" value={separator} onChange={(e) => setSeparator(e.target.value)} /></label>
            <label>Starting Number <input className="mt-1 w-full rounded border border-slate-300 px-2 py-1" value={startingNumber} onChange={(e) => setStartingNumber(e.target.value)} /></label>
            <label>Padding Length <input type="number" className="mt-1 w-full rounded border border-slate-300 px-2 py-1" value={paddingLength} onChange={(e) => setPaddingLength(Number(e.target.value))} /></label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={autoGenerateOnReceive} onChange={(e) => setAutoGenerateOnReceive(e.target.checked)} /> Auto-generate on receive</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={allowManualOverride} onChange={(e) => setAllowManualOverride(e.target.checked)} /> Allow manual override</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={requireUniqueness} onChange={(e) => setRequireUniqueness(e.target.checked)} /> Require uniqueness</label>
            <p className="rounded bg-slate-50 px-2 py-1 text-xs text-slate-600">Preview: {`${prefix}${separator}${String(Number(startingNumber)).padStart(paddingLength, '0')}`}</p>
          </div>
        </article>

        <article className="erp-card p-4 text-sm text-slate-600">
          <h3 className="text-sm font-semibold text-slate-800">Imports / Integrations</h3>
          <p className="mt-2">CSV/XLSX upload zone, field mapping, validation summary, and row-level error report (coming soon).</p>
        </article>
      
        <article className="erp-card p-4 text-sm text-slate-600">
          <h3 className="text-sm font-semibold text-slate-800">Role / Security Direction</h3>
          <ul className="mt-2 list-disc space-y-1 pl-4">
            <li>System Admin: manage users, roles, protected settings, full activity view, override restricted actions.</li>
            <li>Operations Manager / Warehouse / Purchasing / Viewer role boundaries prepared for RBAC.</li>
            <li>Archive is preferred over hard delete; hard delete reserved for high-level admin cases.</li>
            <li>No shared operational users by default.</li>
          </ul>
        </article>

=======
import { ModulePageShell } from '@/components/module-page-shell';

const sections = [
  { title: 'General', notes: 'Site defaults, date formats, and operational preferences.' },
  { title: 'Imports (coming soon)', notes: 'CSV/XLSX upload zone, field mapping, validation summary, row-level error report.' },
  { title: 'Integrations (coming soon)', notes: 'Future connectors for ERP, carriers, and procurement systems.' },
  { title: 'Data Management (coming soon)', notes: 'Reference lists for locations, departments, customers, and carriers.' },
];

export default function SettingsPage() {
  return (
    <ModulePageShell title="Settings" subtitle="System configuration and future import/integration controls">
      <div className="grid gap-4 md:grid-cols-2">
        {sections.map((section) => (
          <article key={section.title} className="erp-card p-4">
            <h3 className="text-sm font-semibold text-slate-800">{section.title}</h3>
            <p className="mt-2 text-sm text-slate-600">{section.notes}</p>
          </article>
        ))}
>>>>>>> origin/main
      </div>
    </ModulePageShell>
  );
}
