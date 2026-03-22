import { notFound } from 'next/navigation';
import { freightQuotes, shipmentLog } from '@/lib/data/mock-data';
import { freightEstimates } from '@/lib/logic';

export default function FreightQuoteDetailPage({ params }: { params: { quoteId: string } }) {
  const quote = freightQuotes.find((row) => row.quoteId === params.quoteId);
  if (!quote) return notFound();
  const linkedShipments = shipmentLog.filter((s) => s.carrier.includes('Freight'));
  const fx = freightEstimates(quote);

  return <div className="space-y-3"><div className="erp-card p-4"><div className="flex items-start justify-between gap-3"><div><h2 className="text-lg font-semibold">{quote.quoteId}</h2><p className="text-sm text-slate-600">{quote.originZip} → {quote.destinationZip} · {quote.serviceType}</p></div><div className="mt-2 flex gap-2 text-xs"><button className="rounded border border-slate-300 px-2 py-1">Edit Freight Quote</button><button className="rounded border border-slate-300 px-2 py-1">Archive Freight Quote</button><button className="rounded border border-slate-300 px-2 py-1">Delete Freight Quote</button></div></div><div className="mt-3 grid gap-2 text-xs md:grid-cols-3"><p><span className="font-semibold">Low/Avg/High:</span> ${fx.low} / ${fx.avg} / ${fx.high}</p><p><span className="font-semibold">Cost per Mile:</span> ${fx.costPerMile}</p><p><span className="font-semibold">Cost per Lb:</span> ${fx.costPerLb}</p><p><span className="font-semibold">Created By:</span> M. Ortega</p><p><span className="font-semibold">Created At:</span> 2026-03-01T10:30:00Z</p><p><span className="font-semibold">Updated By:</span> D. Young</p></div></div><div className="erp-card p-4"><h3 className="text-sm font-semibold">Shipment / Serial Linkage</h3><p className="mt-2 text-sm text-slate-600">{linkedShipments.map((s) => `${s.id}:${s.serialNumber}`).join(', ') || 'No linked shipments.'}</p></div></div>;
}
