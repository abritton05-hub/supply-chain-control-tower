import { notFound } from 'next/navigation';
import { shipmentLog } from '@/lib/data/mock-data';

export default function ShipmentDetailPage({ params }: { params: { shipmentId: string } }) {
  const shipment = shipmentLog.find((row) => row.id === params.shipmentId);
  if (!shipment) return notFound();
  return <div className="erp-card p-4"><h2 className="text-lg font-semibold">{shipment.id}</h2><p className="text-sm text-slate-600">{shipment.customer} · {shipment.trackingNumber} · {shipment.status}</p></div>;
}
