import { SectionHeader } from '@/components/section-header';

const upcomingWorkflow = [
  'Pickups from warehouse and supplier locations',
  'Drop-offs by job site and customer priority',
  'Kits and loose items loaded per stop',
  'Scheduled delivery day windows',
  'Driver assignment and dispatch visibility',
];

export default function DriverManifestPage() {
  return (
    <div className="space-y-4">
      <SectionHeader title="Driver Manifest" subtitle="Operational dispatch planning for outbound deliveries (placeholder)" />

      <section className="erp-card p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">Planned Workflow</h2>
        <p className="mt-2 text-sm text-slate-600">
          This module will coordinate daily delivery manifests once kit readiness and dispatch scheduling are finalized.
        </p>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-slate-700">
          {upcomingWorkflow.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}
