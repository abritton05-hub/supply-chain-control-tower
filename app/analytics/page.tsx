import { HeatMapWidget } from '@/components/heat-map';
import { KpiCard } from '@/components/kpi-card';
import { SectionHeader } from '@/components/section-header';
import { freightQuotes, inventoryItems, projectBuilds, serialRecords, shipmentLog } from '@/lib/data/mock-data';
import { freightEstimates, inventoryMetrics } from '@/lib/logic';

export default function AnalyticsPage() {
  const topRisk = inventoryItems.map((i) => ({ ...i, ...inventoryMetrics(i) })).sort((a, b) => b.riskScore - a.riskScore).slice(0, 10);
  const shortageCount = inventoryItems.filter((i) => inventoryMetrics(i).reorderNeeded === 'YES').length;
  const freightSpend = freightQuotes.reduce((sum, q) => sum + freightEstimates(q).avg, 0);
  const avgCostPerMile = (freightQuotes.reduce((sum, q) => sum + Number(freightEstimates(q).costPerMile), 0) / freightQuotes.length).toFixed(2);
  const activeProjects = projectBuilds.filter((p) => p.buildStatus !== 'COMPLETE').length;
  const openSerials = serialRecords.filter((s) => s.status !== 'SHIPPED').length;
  const shippedSerials = serialRecords.filter((s) => s.status === 'SHIPPED').length;

  return <div className='space-y-6'>
    <SectionHeader title='Analytics' subtitle='Risk, freight, project, and traceability dashboards' />

    <section className='space-y-3'>
      <h3 className='text-sm font-semibold text-slate-700'>Inventory Risk Dashboard</h3>
      <div className='grid gap-4 md:grid-cols-3'><KpiCard label='Shortage Summary' value={shortageCount} /><KpiCard label='Highest Risk Score' value={topRisk[0]?.riskScore ?? 0} /><KpiCard label='Items Reviewed' value={inventoryItems.length} /></div>
      <HeatMapWidget />
      <div className='erp-card p-4 text-sm'>Top 10 Highest Risk Items: {topRisk.map((i) => `${i.itemId} (${i.riskScore})`).join(', ')}</div>
    </section>

    <section className='space-y-3'>
      <h3 className='text-sm font-semibold text-slate-700'>Freight Dashboard</h3>
      <div className='grid gap-4 md:grid-cols-4'><KpiCard label='Freight Spend Overview' value={`$${freightSpend}`} /><KpiCard label='Cost per Mile Trend (avg)' value={`$${avgCostPerMile}`} /><KpiCard label='Carrier Performance' value='On-time 92%' /><KpiCard label='Shipment Status Summary' value={`${shipmentLog.length} total`} /></div>
    </section>

    <section className='space-y-3'>
      <h3 className='text-sm font-semibold text-slate-700'>Project Dashboard</h3>
      <div className='grid gap-4 md:grid-cols-4'><KpiCard label='Active Projects' value={activeProjects} /><KpiCard label='Material Allocation Issues' value={projectBuilds.filter((p) => p.issuedQty < p.requiredQty).length} /><KpiCard label='Build Status Summary' value='2 In Progress' /><KpiCard label='Project Shipping Status' value='1 Partial' /></div>
    </section>

    <section className='space-y-3'>
      <h3 className='text-sm font-semibold text-slate-700'>Traceability Dashboard</h3>
      <div className='grid gap-4 md:grid-cols-4'><KpiCard label='Open Serials in Process' value={openSerials} /><KpiCard label='Shipped Serials' value={shippedSerials} /><KpiCard label='Exceptions / Missing Fields' value={serialRecords.filter((s) => s.status === 'EXCEPTION').length} /><KpiCard label='Recent Received-to-Shipped Timeline' value='Median 4.2 days' /></div>
    </section>
  </div>;
}
