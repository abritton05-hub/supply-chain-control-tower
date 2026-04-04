import { KpiCard } from '@/components/kpi-card';
import { SectionHeader } from '@/components/section-header';
import { projectBuilds } from '@/lib/data/mock-data';

export default function ProjectDashboardPage() {
  return <div className="space-y-4"><SectionHeader title="Project Dashboard" subtitle="Build allocation, status, and shipping readiness" /><div className="grid gap-3 md:grid-cols-4"><KpiCard label="Active Projects" value={projectBuilds.filter((p) => p.buildStatus !== 'COMPLETE').length} /><KpiCard label="Allocation Issues" value={projectBuilds.filter((p) => p.issuedQty < p.requiredQty).length} /><KpiCard label="Build In Progress" value={projectBuilds.filter((p) => p.buildStatus === 'IN_PROGRESS').length} /><KpiCard label="Ready to Ship" value={projectBuilds.filter((p) => p.shipStatus === 'SHIPPED').length} /></div></div>;
}
