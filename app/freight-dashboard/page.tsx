import { KpiCard } from '@/components/kpi-card';
import { SectionHeader } from '@/components/section-header';
import { freightQuotes, shipmentLog } from '@/lib/data/mock-data';
import { freightEstimates } from '@/lib/logic';

export default function FreightDashboardPage() {
  const spend = freightQuotes.reduce((sum, q) => sum + freightEstimates(q).avg, 0);
  const avgCpm = (freightQuotes.reduce((sum, q) => sum + Number(freightEstimates(q).costPerMile), 0) / freightQuotes.length).toFixed(2);
  return <div className="space-y-4"><SectionHeader title="Freight Dashboard" subtitle="Freight spend and carrier shipment performance" /><div className="grid gap-3 md:grid-cols-4"><KpiCard label="Freight Spend" value={`$${spend}`} /><KpiCard label="Avg Cost / Mile" value={`$${avgCpm}`} /><KpiCard label="Carrier Performance" value="On-time 92%" /><KpiCard label="Shipment Status Summary" value={`${shipmentLog.length} shipments`} /></div><div className="erp-card p-4 text-sm text-slate-600">Trend panels and carrier benchmarking placeholder.</div></div>;
}
