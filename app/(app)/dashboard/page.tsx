import { SectionHeader } from '@/components/section-header';

const LOCATIONS = [
  {
    code: 'SEA991',
    label: 'Primary Logistics Hub',
    purpose: 'Default inventory, receiving, staging, shipping, and delivery control.',
  },
  {
    code: 'WH/A13',
    label: 'Warehouse / A13',
    purpose: 'Warehouse pickups, overflow storage, and controlled movement into SEA991.',
  },
  {
    code: 'SEA99',
    label: 'Transfer Site',
    purpose: 'Transfer location for inbound/outbound LEO movement.',
  },
  {
    code: 'SEA111',
    label: 'Transfer Site',
    purpose: 'Transfer location for inbound/outbound LEO movement.',
  },
  {
    code: 'SEA129',
    label: 'Transfer Site',
    purpose: 'Transfer location for inbound/outbound LEO movement.',
  },
  {
    code: 'SEA133',
    label: 'Transfer Site',
    purpose: 'Transfer location for inbound/outbound LEO movement.',
  },
  {
    code: 'SEA143',
    label: 'Transfer Site',
    purpose: 'Transfer location for inbound/outbound LEO movement.',
  },
];

export default function DashboardPage() {
  return (
    <div className="space-y-4">
      <SectionHeader
        title="Executive Dashboard"
        subtitle="High-level operational visibility across logistics, shipping, receiving, inventory, and site movement"
      />

      <div className="grid gap-4 md:grid-cols-3">
        {LOCATIONS.map((location) => (
          <div key={location.code} className="erp-panel p-5">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Location
            </div>
            <h2 className="mt-2 text-2xl font-bold text-slate-900">
              {location.code}
            </h2>
            <p className="mt-1 text-sm font-semibold text-slate-700">
              {location.label}
            </p>
            <p className="mt-3 text-sm leading-6 text-slate-500">
              {location.purpose}
            </p>
          </div>
        ))}
      </div>

      <div className="erp-panel p-6">
        <h2 className="text-lg font-semibold text-slate-900">
          Logistics Control View
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          Track material movement across SEA991, WH/A13, and all transfer sites
          (SEA99, SEA111, SEA129, SEA133, SEA143). Receiving, pickups,
          drop-offs, manifests, BOM releases, and inventory bin locations should
          all roll up into this dashboard.
        </p>
      </div>
    </div>
  );
}