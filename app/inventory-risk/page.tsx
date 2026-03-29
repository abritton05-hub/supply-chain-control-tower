'use client';

import Link from 'next/link';
import { HeatMapWidget } from '@/components/heat-map';
import { KpiCard } from '@/components/kpi-card';
import { SectionHeader } from '@/components/section-header';
import { inventoryItems } from '@/lib/data/mock-data';
import { inventoryMetrics } from '@/lib/logic';

type ChartSlice = {
  label: string;
  value: number;
  color: string;
};

function DonutChart({
  title,
  slices,
}: {
  title: string;
  slices: ChartSlice[];
}) {
  const total = Math.max(
    slices.reduce((sum, slice) => sum + slice.value, 0),
    1,
  );

  let running = 0;
  const gradient = slices
    .map((slice) => {
      const start = (running / total) * 100;
      running += slice.value;
      const end = (running / total) * 100;
      return `${slice.color} ${start}% ${end}%`;
    })
    .join(', ');

  return (
    <article className="erp-card p-4">
      <h3 className="mb-3 border-b border-slate-200 pb-2 text-base font-semibold text-slate-900">{title}</h3>

      <div className="flex flex-col items-center gap-4 md:flex-row">
        <div
          className="relative h-36 w-36 rounded-full"
          style={{ background: `conic-gradient(${gradient})` }}
        >
          <div className="absolute inset-[18px] flex items-center justify-center rounded-full bg-white text-center">
            <div>
              <div className="text-xs text-slate-500">Total</div>
              <div className="text-xl font-semibold text-slate-900">{total}</div>
            </div>
          </div>
        </div>

        <div className="grid flex-1 gap-2">
          {slices.map((slice) => (
            <div key={slice.label} className="flex items-center justify-between rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
              <div className="flex items-center gap-2">
                <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: slice.color }} />
                <span className="font-medium text-slate-700">{slice.label}</span>
              </div>
              <span className="font-semibold text-slate-900">{slice.value}</span>
            </div>
          ))}
        </div>
      </div>
    </article>
  );
}

function priorityColor(priority: string) {
  if (priority === 'URGENT') return 'text-rose-900 bg-rose-200 border-rose-400';
  if (priority === 'ORDER NOW') return 'text-rose-800 bg-rose-100 border-rose-300';
  if (priority === 'RISK') return 'text-orange-800 bg-orange-100 border-orange-300';
  if (priority === 'REVIEW') return 'text-amber-800 bg-amber-100 border-amber-300';
  return 'text-emerald-800 bg-emerald-100 border-emerald-300';
}

export default function InventoryRiskPage() {
  const enriched = inventoryItems.map((i) => ({ ...i, ...inventoryMetrics(i) }));
  const top = [...enriched].sort((a, b) => b.riskScore - a.riskScore).slice(0, 10);

  const priorityCounts = {
    URGENT: enriched.filter((i) => i.priority === 'URGENT').length,
    ORDER_NOW: enriched.filter((i) => i.priority === 'ORDER NOW').length,
    RISK: enriched.filter((i) => i.priority === 'RISK').length,
    REVIEW: enriched.filter((i) => i.priority === 'REVIEW').length,
    OK: enriched.filter((i) => i.priority === 'OK').length,
  };

  const criticalityCounts = {
    CRITICAL: enriched.filter((i) => i.criticality === 'CRITICAL').length,
    HIGH: enriched.filter((i) => i.criticality === 'HIGH').length,
    NORMAL: enriched.filter((i) => i.criticality === 'NORMAL').length,
    LOW: enriched.filter((i) => i.criticality === 'LOW').length,
  };

  const daysCoverCounts = {
    '0-5': enriched.filter((i) => i.daysCover <= 5).length,
    '6-10': enriched.filter((i) => i.daysCover > 5 && i.daysCover <= 10).length,
    '11-20': enriched.filter((i) => i.daysCover > 10 && i.daysCover <= 20).length,
    '21+': enriched.filter((i) => i.daysCover > 20).length,
  };

  return (
    <div className="space-y-4">
      <SectionHeader title="Inventory Risk" subtitle="Heat map and shortage risk watchlist" />

      <div className="grid gap-3 md:grid-cols-4">
        <KpiCard label="URGENT" value={priorityCounts.URGENT} />
        <KpiCard label="ORDER NOW" value={priorityCounts.ORDER_NOW} />
        <KpiCard label="RISK" value={priorityCounts.RISK} />
        <KpiCard label="Top Risk Score" value={top[0]?.riskScore ?? 0} />
      </div>

      <div className="erp-card p-4">
        <h3 className="mb-3 border-b border-slate-200 pb-2 text-base font-semibold text-slate-900">Top 10 Risk Items</h3>

        <div className="flex flex-wrap gap-2">
          {top.map((item) => (
            <Link
              key={item.itemId}
              href={`/inventory/${item.itemId}`}
              className={`rounded border px-3 py-2 text-sm font-medium hover:underline ${priorityColor(item.priority)}`}
            >
              {item.itemId} ({item.riskScore})
            </Link>
          ))}
        </div>

        <div className="mt-4 rounded border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
         
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <DonutChart
          title="Priority Mix"
          slices={[
            { label: 'URGENT', value: priorityCounts.URGENT, color: '#881337' },
            { label: 'ORDER NOW', value: priorityCounts.ORDER_NOW, color: '#e11d48' },
            { label: 'RISK', value: priorityCounts.RISK, color: '#f97316' },
            { label: 'REVIEW', value: priorityCounts.REVIEW, color: '#facc15' },
            { label: 'OK', value: priorityCounts.OK, color: '#22c55e' },
          ]}
        />

        <DonutChart
          title="Criticality Mix"
          slices={[
            { label: 'CRITICAL', value: criticalityCounts.CRITICAL, color: '#dc2626' },
            { label: 'HIGH', value: criticalityCounts.HIGH, color: '#f97316' },
            { label: 'NORMAL', value: criticalityCounts.NORMAL, color: '#facc15' },
            { label: 'LOW', value: criticalityCounts.LOW, color: '#22c55e' },
          ]}
        />

        <DonutChart
          title="Days Cover Mix"
          slices={[
            { label: '0–5', value: daysCoverCounts['0-5'], color: '#dc2626' },
            { label: '6–10', value: daysCoverCounts['6-10'], color: '#f97316' },
            { label: '11–20', value: daysCoverCounts['11-20'], color: '#facc15' },
            { label: '21+', value: daysCoverCounts['21+'], color: '#22c55e' },
          ]}
        />
      </div>

      <HeatMapWidget />
    </div>
  );
}