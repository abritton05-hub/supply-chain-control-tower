import { KpiCard } from '@/components/kpi-card';
import { SectionHeader } from '@/components/section-header';
import { serialRecords } from '@/lib/data/mock-data';

export default function TraceabilityDashboardPage() {
  return <div className="space-y-4"><SectionHeader title="Traceability Dashboard" subtitle="Serialized lifecycle and exception visibility" /><div className="grid gap-3 md:grid-cols-4"><KpiCard label="Open Serials" value={serialRecords.filter((s) => s.status !== 'Shipped').length} /><KpiCard label="Shipped Serials" value={serialRecords.filter((s) => s.status === 'Shipped').length} /><KpiCard label="Exceptions" value={serialRecords.filter((s) => s.currentLocation === 'Exception Hold').length} /><KpiCard label="Lifecycle Median" value="4.2 days" /></div></div>;
}
