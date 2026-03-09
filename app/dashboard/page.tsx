import { KpiCard } from '@/components/kpi-card';
import { SectionHeader } from '@/components/section-header';
import { inventoryItems, projectBuilds, purchaseOrders, shipmentLog } from '@/lib/data/mock-data';
import { inventoryMetrics } from '@/lib/logic';

export default function DashboardPage() {
  const lowStock = inventoryItems.filter((i) => inventoryMetrics(i).reorderNeeded === 'YES').length;
  const critical = inventoryItems.filter((i) => i.criticality === 'CRITICAL').length;
  const openPos = purchaseOrders.filter((p) => p.status !== 'CLOSED').length;
  const delayed = shipmentLog.filter((s) => s.status === 'DELAYED').length;
  const activeProjects = projectBuilds.filter((p) => p.buildStatus !== 'COMPLETE').length;
  const inTransit = shipmentLog.filter((s) => s.status === 'IN_TRANSIT').length;

  return (
    <div className="space-y-4">
      <SectionHeader title="Executive Dashboard" subtitle="Operational KPIs for inventory, procurement, fulfillment, and projects" />
      <div className="erp-banner">
        <p className="text-sm font-semibold">Daily Executive Snapshot</p>
        <p className="text-xs text-slate-200">Use the sidebar for module-level drill-down and exception handling.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
        <KpiCard label="Low Stock Items" value={lowStock} />
        <KpiCard label="Critical Items" value={critical} />
        <KpiCard label="Open POs" value={openPos} />
        <KpiCard label="Delayed Shipments" value={delayed} />
        <KpiCard label="Active Projects" value={activeProjects} />
        <KpiCard label="Shipments In Transit" value={inTransit} />
      </div>
    </div>
  );
}
