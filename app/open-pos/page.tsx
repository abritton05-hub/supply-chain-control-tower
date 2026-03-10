import { DataTable } from '@/components/data-table';
import { SectionHeader } from '@/components/section-header';
import { StatusChip } from '@/components/status-chip';
import { purchaseOrders } from '@/lib/data/mock-data';
import { poDaysLate } from '@/lib/logic';

export default function OpenPosPage() {
  return <div><SectionHeader title="Open Purchase Orders" subtitle="Inbound PO monitoring with lateness calculation" /><DataTable><thead><tr>{['PO Number','Vendor','Item ID','Project','Qty Ordered','Order Date','Expected Delivery','Status','Days Late'].map((h)=><th key={h}>{h}</th>)}</tr></thead><tbody>{purchaseOrders.map((po)=><tr key={po.poNumber}><td>{po.poNumber}</td><td>{po.vendor}</td><td>{po.itemId}</td><td>{po.project}</td><td>{po.qtyOrdered}</td><td>{po.orderDate ?? '-'}</td><td>{po.expectedDelivery ?? '-'}</td><td><StatusChip value={po.status} /></td><td>{poDaysLate(po)}</td></tr>)}</tbody></DataTable></div>;
}
