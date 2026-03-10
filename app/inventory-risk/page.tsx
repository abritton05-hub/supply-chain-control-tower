import { HeatMapWidget } from '@/components/heat-map';
import { KpiCard } from '@/components/kpi-card';
import { SectionHeader } from '@/components/section-header';
import { inventoryItems } from '@/lib/data/mock-data';
import { inventoryMetrics } from '@/lib/logic';

export default function InventoryRiskPage() {
  const enriched = inventoryItems.map((i) => ({ ...i, ...inventoryMetrics(i) }));
  const top = [...enriched].sort((a, b) => b.riskScore - a.riskScore).slice(0, 10);
  return (
    <div className="space-y-4">
      <SectionHeader title="Inventory Risk" subtitle="Heat map and shortage risk watchlist" />
      <div className="grid gap-3 md:grid-cols-4">
        <KpiCard label="ORDER NOW" value={enriched.filter((i) => i.priority === 'ORDER NOW').length} />
        <KpiCard label="RISK" value={enriched.filter((i) => i.priority === 'RISK').length} />
        <KpiCard label="REVIEW" value={enriched.filter((i) => i.priority === 'REVIEW').length} />
        <KpiCard label="Top Risk Score" value={top[0]?.riskScore ?? 0} />
      </div>
      <HeatMapWidget />
      <div className="erp-card p-4 text-sm">Top 10 risk items: {top.map((i) => `${i.itemId} (${i.riskScore})`).join(', ')}</div>
    </div>
  );
}
