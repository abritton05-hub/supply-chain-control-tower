import { SectionHeader } from '@/components/section-header';

const anchors = [
  'Items',
  'Transactions',
  'Purchase Orders',
  'Serial Traceability',
];

const modules = [
  { title: 'Dashboard / Control Tower', bullets: ['KPI cards', 'Top risk items', 'Late PO list', 'Shipments at risk'] },
  { title: 'Inventory Master', bullets: ['Item attributes', 'Reorder logic', 'Criticality + risk tags', 'Preferred vendor mapping'] },
  { title: 'Transactions Engine', bullets: ['Receive / Issue / Transfer / Adjust', 'Immutable movement history', 'On-hand derived from transactions'] },
  { title: 'Serial Traceability', bullets: ['Chain of custody', 'Project/work order assignment', 'Shipped/delivered lifecycle'] },
  { title: 'Projects / Builds', bullets: ['Required vs issued qty', 'Shortage visibility', 'Ship readiness status'] },
  { title: 'Purchasing / POs', bullets: ['Open / partial / late state', 'Days-late tracking', 'Receipt linkage to inventory'] },
  { title: 'Shipping / Freight', bullets: ['Shipment log + delay flag', 'Freight quote calculator', 'Carrier/status tracking'] },
  { title: 'AI Document Intake', bullets: ['Classify source documents first', 'Prefill workflow forms with confidence', 'Require review before save'] },
  { title: 'Roles & Controls', bullets: ['Admin controls', 'Warehouse workflow', 'Purchasing permissions', 'Leadership read-only drilldown'] },
];

export default function BlueprintPage() {
  return (
    <div className="space-y-5">
      <SectionHeader
        title="Inventory Management App Blueprint"
        subtitle="Control Tower Inventory: workbook-to-application operating model"
      />

      <section className="erp-banner">
        <p className="text-base font-semibold">Data integrity first. Pretty charts second.</p>
        <p className="text-xs text-slate-200">Version 1 anchors: Items, Transactions, POs, Serials — then layer advanced control tower dashboards.</p>
      </section>

      <section className="erp-card p-4">
        <h3 className="mb-2 text-sm font-semibold text-slate-700">Phase 1 Core Anchors</h3>
        <div className="grid gap-3 md:grid-cols-4">
          {anchors.map((a) => (
            <div key={a} className="rounded border border-cyan-200 bg-cyan-50 px-3 py-2 text-center text-sm font-semibold text-cyan-800">
              {a}
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        {modules.map((module) => (
          <article key={module.title} className="erp-card p-4">
            <h4 className="mb-2 text-sm font-semibold text-slate-800">{module.title}</h4>
            <ul className="list-disc space-y-1 pl-4 text-sm text-slate-600">
              {module.bullets.map((bullet) => (
                <li key={bullet}>{bullet}</li>
              ))}
            </ul>
          </article>
        ))}
      </section>
    </div>
  );
}
