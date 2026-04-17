import { notFound } from 'next/navigation';
import { serialRecords, shipmentLog } from '@/lib/data/mock-data';

export default function ShipmentDetailPage({ params }: { params: { shipmentId: string } }) {
  const shipment = shipmentLog.find((row) => row.id === params.shipmentId);
  if (!shipment) return notFound();
  const linked = serialRecords.filter((s) => s.shipmentId === shipment.id || s.serialNumber === shipment.serialNumber);
  return <div className="space-y-3"><div className="erp-card p-4"><h2 className="text-lg font-semibold">{shipment.id}</h2><p className="text-sm text-slate-600">{shipment.customer} · {shipment.trackingNumber} · {shipment.status}</p><div className="mt-2 flex gap-2 text-xs"><button className="rounded border border-slate-300 px-2 py-1">Edit Shipment</button><button className="rounded border border-slate-300 px-2 py-1">Archive Shipment</button><button className="rounded border border-slate-300 px-2 py-1">Delete Shipment</button></div></div><div className="erp-card p-4"><h3 className="text-sm font-semibold">Linked Serials</h3><p className="mt-2 text-sm text-slate-600">{linked.map((s) => s.serialNumber).join(', ') || 'None linked.'}</p></div></div>;
}
