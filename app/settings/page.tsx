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
      </div>
    </ModulePageShell>
  );
}
