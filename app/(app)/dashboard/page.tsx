import { SectionHeader } from '@/components/section-header';

export default function DashboardPage() {
  return (
    <div className="space-y-4">
      <SectionHeader
        title="Executive Dashboard"
        subtitle="High-level operational visibility across logistics"
      />

      <div className="erp-panel p-6">
        <h2 className="text-lg font-semibold">Shipping Flow</h2>
        <p className="text-sm text-slate-500">
          Movement to and from SEA991
        </p>
      </div>
    </div>
  );
}