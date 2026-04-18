import { SectionHeader } from '@/components/section-header';

const workflowItems = [
  {
    label: 'Pickups',
    description: 'Capture warehouse pickup stops, ready windows, staging notes, and required handoff details.',
  },
  {
    label: 'Drop-offs',
    description: 'Track destination stops, delivery contacts, receiving windows, and proof-of-delivery requirements.',
  },
  {
    label: 'Kits / Items',
    description: 'Connect each manifest line to the kits, BOM items, serialized assets, and quantities loaded.',
  },
  {
    label: 'Scheduled Delivery Day',
    description: 'Plan the delivery date that operations, projects, and drivers can all work from.',
  },
  {
    label: 'Driver Assignment',
    description: 'Assign the responsible driver and keep ownership visible before dispatch.',
  },
];

export default function DriverManifestPage() {
  return (
    <div className="space-y-4">
      <SectionHeader
        title="Driver Manifest"
        subtitle="Planned dispatch workflow for kit deliveries, pickups, drop-offs, and driver assignments"
      />

      <div className="erp-panel p-5">
        <div className="max-w-3xl">
          <h2 className="text-lg font-semibold text-slate-900">Manifest workflow placeholder</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            This page will become the operational handoff between kit readiness and field delivery.
            The first production version should keep dispatch simple: one manifest per scheduled
            delivery day, tied back to kits and the inventory items being moved.
          </p>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {workflowItems.map((item) => (
          <div key={item.label} className="erp-panel p-4">
            <div className="text-sm font-semibold text-slate-900">{item.label}</div>
            <p className="mt-2 text-sm leading-6 text-slate-600">{item.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
