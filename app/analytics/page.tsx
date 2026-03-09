import { HeatMapWidget } from '@/components/heat-map';
import { KpiCard } from '@/components/kpi-card';
import { ModulePageShell } from '@/components/module-page-shell';
import { inventoryItems, freightQuotes, projectBuilds, serialRecords, shipmentLog } from '@/lib/data/mock-data';
import { freightEstimates, inventoryMetrics } from '@/lib/logic';

export default function AnalyticsPage() {
  const enriched = inventoryItems.map((i) => ({ ...i, ...inventoryMetrics(i) }));
  const topRisk = enriched.sort((a, b) => b.riskScore - a.riskScore).slice(0, 10);
  const priorityCount = {
    orderNow: enriched.filter((i) => i.priority === 'ORDER NOW').length,
    risk: enriched.filter((i) => i.priority === 'RISK').length,
    review: enriched.filter((i) => i.priority === 'REVIEW').length,
    ok: enriched.filter((i) => i.priority === 'OK').length,
  };

  const freightSpend = freightQuotes.reduce((sum, q) => sum + freightEstimates(q).avg, 0);

  return (
    <ModulePageShell title="Analytics" subtitle="Inventory risk, freight, project, and traceability intelligence">
      <div className="space-y-6">
        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-700">Inventory Risk</h3>
          <div className="grid gap-4 md:grid-cols-4"><KpiCard label="ORDER NOW" value={priorityCount.orderNow} /><KpiCard label="RISK" value={priorityCount.risk} /><KpiCard label="REVIEW" value={priorityCount.review} /><KpiCard label="OK" value={priorityCount.ok} /></div>
          <HeatMapWidget />
          <div className="erp-card p-4 text-sm">Top 10 highest risk items: {topRisk.map((i) => `${i.itemId} (${i.riskScore})`).join(', ')}</div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <KpiCard label="Freight Spend Overview" value={`$${freightSpend}`} />
          <KpiCard label="Project Allocation Issues" value={projectBuilds.filter((p) => p.issuedQty < p.requiredQty).length} />
          <KpiCard label="Open Serials in Process" value={serialRecords.filter((s) => s.status !== 'SHIPPED').length} />
        </section>

        <section className="erp-card p-4 text-sm text-slate-600">
          Freight dashboard: cost-per-mile trends and carrier performance placeholders. Project dashboard: build/ship readiness. Traceability dashboard: exceptions and lifecycle timing. Shipment status summary count: {shipmentLog.length}.
        </section>
      </div>
    </ModulePageShell>
  );
}
