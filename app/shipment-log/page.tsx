<<<<<<< HEAD
import Link from 'next/link';
=======
>>>>>>> origin/main
import { DataTable } from '@/components/data-table';
import { SectionHeader } from '@/components/section-header';
import { StatusChip } from '@/components/status-chip';
import { shipmentLog } from '@/lib/data/mock-data';
import { shipmentDelayFlag } from '@/lib/logic';

export default function ShipmentLogPage() {
<<<<<<< HEAD
  return <div><SectionHeader title="Shipment Log" subtitle="Outbound shipping visibility with delay flag" actions={<button className="rounded border border-slate-300 bg-white px-2 py-1 text-xs">Add Shipment</button>} /><DataTable><thead><tr>{['Shipment ID','Ship Date','Project','PO Number','Customer','Item ID','Serial Number','Carrier','Tracking Number','Waybill','Estimated Delivery','Actual Delivery','Status','Delay Flag'].map((h)=><th key={h}>{h}</th>)}</tr></thead><tbody>{shipmentLog.map((s)=><tr key={s.trackingNumber}><td><Link href={`/shipment-log/${s.id}`} className="text-cyan-700 font-semibold hover:underline">{s.id}</Link></td><td>{s.shipDate}</td><td><Link href={`/projects/${s.project}`} className="text-cyan-700 hover:underline">{s.project}</Link></td><td><Link href={`/open-pos/${s.poNumber}`} className="text-cyan-700 hover:underline">{s.poNumber}</Link></td><td>{s.customer}</td><td><Link href={`/inventory/${s.itemId}`} className="text-cyan-700 hover:underline">{s.itemId}</Link></td><td><Link href={`/serial-traceability/${s.serialNumber}`} className="text-cyan-700 hover:underline">{s.serialNumber}</Link></td><td>{s.carrier}</td><td>{s.trackingNumber}</td><td>{s.waybill}</td><td>{s.estimatedDelivery}</td><td>{s.actualDelivery ?? '-'}</td><td><StatusChip value={s.status} /></td><td>{shipmentDelayFlag(s)}</td></tr>)}</tbody></DataTable></div>;
=======
  return <div><SectionHeader title="Shipment Log" subtitle="Outbound shipping visibility with delay flag" /><DataTable><thead><tr>{['Ship Date','Project','PO Number','Customer','Item ID','Serial Number','Carrier','Tracking Number','Waybill','Estimated Delivery','Actual Delivery','Status','Delay Flag'].map((h)=><th key={h}>{h}</th>)}</tr></thead><tbody>{shipmentLog.map((s)=><tr key={s.trackingNumber}><td>{s.shipDate}</td><td>{s.project}</td><td>{s.poNumber}</td><td>{s.customer}</td><td>{s.itemId}</td><td>{s.serialNumber}</td><td>{s.carrier}</td><td>{s.trackingNumber}</td><td>{s.waybill}</td><td>{s.estimatedDelivery}</td><td>{s.actualDelivery ?? '-'}</td><td><StatusChip value={s.status} /></td><td>{shipmentDelayFlag(s)}</td></tr>)}</tbody></DataTable></div>;
>>>>>>> origin/main
}
