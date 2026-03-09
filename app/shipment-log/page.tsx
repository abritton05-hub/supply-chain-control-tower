import { DataTable } from '@/components/data-table';
import { SectionHeader } from '@/components/section-header';
import { StatusChip } from '@/components/status-chip';
import { shipmentLog } from '@/lib/data/mock-data';
import { shipmentDelayFlag } from '@/lib/logic';

export default function ShipmentLogPage() {
  return <div><SectionHeader title="Shipment Log" subtitle="Outbound shipping visibility with delay flag" /><DataTable><thead><tr>{['Ship Date','Project','PO Number','Customer','Item ID','Serial Number','Carrier','Tracking Number','Waybill','Estimated Delivery','Actual Delivery','Status','Delay Flag'].map((h)=><th key={h}>{h}</th>)}</tr></thead><tbody>{shipmentLog.map((s)=><tr key={s.trackingNumber}><td>{s.shipDate}</td><td>{s.project}</td><td>{s.poNumber}</td><td>{s.customer}</td><td>{s.itemId}</td><td>{s.serialNumber}</td><td>{s.carrier}</td><td>{s.trackingNumber}</td><td>{s.waybill}</td><td>{s.estimatedDelivery}</td><td>{s.actualDelivery ?? '-'}</td><td><StatusChip value={s.status} /></td><td>{shipmentDelayFlag(s)}</td></tr>)}</tbody></DataTable></div>;
}
