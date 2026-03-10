import { notFound } from 'next/navigation';
<<<<<<< HEAD
import { freightQuotes, shipmentLog } from '@/lib/data/mock-data';
=======
import { freightQuotes } from '@/lib/data/mock-data';
>>>>>>> origin/main

export default function FreightQuoteDetailPage({ params }: { params: { quoteId: string } }) {
  const quote = freightQuotes.find((row) => row.quoteId === params.quoteId);
  if (!quote) return notFound();
<<<<<<< HEAD
  const linkedShipments = shipmentLog.filter((s) => s.carrier.includes('Freight'));
  return <div className="space-y-3"><div className="erp-card p-4"><h2 className="text-lg font-semibold">{quote.quoteId}</h2><p className="text-sm text-slate-600">{quote.originZip} → {quote.destinationZip} · {quote.serviceType}</p><div className="mt-2 flex gap-2 text-xs"><button className="rounded border border-slate-300 px-2 py-1">Edit Freight Quote</button><button className="rounded border border-slate-300 px-2 py-1">Archive Freight Quote</button><button className="rounded border border-slate-300 px-2 py-1">Delete Freight Quote</button></div></div><div className="erp-card p-4"><h3 className="text-sm font-semibold">Shipment / Serial Linkage</h3><p className="mt-2 text-sm text-slate-600">{linkedShipments.map((s) => `${s.id}:${s.serialNumber}`).join(', ') || 'No linked shipments.'}</p></div></div>;
=======
  return <div className="erp-card p-4"><h2 className="text-lg font-semibold">{quote.quoteId}</h2><p className="text-sm text-slate-600">{quote.originZip} → {quote.destinationZip} · {quote.serviceType}</p></div>;
>>>>>>> origin/main
}
