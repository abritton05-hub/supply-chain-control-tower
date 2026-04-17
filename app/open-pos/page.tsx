import Link from 'next/link';
import { DataTable } from '@/components/data-table';
import { SectionHeader } from '@/components/section-header';
import { StatusChip } from '@/components/status-chip';
import { purchaseOrders } from '@/lib/data/mock-data';
import { poDaysLate } from '@/lib/logic';

export default function OpenPosPage() {
  return <div><SectionHeader title="Open Purchase Orders" subtitle="Inbound PO monitoring with lateness calculation" /><DataTable><thead><tr>{['PO Number','Vendor','Item ID','Project','Qty Ordered','Order Date','Expected Delivery','Status','Days Late'].map((h)=><th key={h}>{h}</th>)}</tr></thead><tbody>{purchaseOrders.map((po)=><tr key={po.poNumber}><td><Link href={`/open-pos/${po.poNumber}`} className="text-cyan-700 font-semibold hover:underline">{po.poNumber}</Link></td><td><Link href={`/vendors/${po.vendor === 'Apex Electronics' ? 'v1' : po.vendor === 'PowerGrid Supply' ? 'v2' : 'v3'}`} className="text-cyan-700 hover:underline">{po.vendor}</Link></td><td><Link href={`/inventory/${po.itemId}`} className="text-cyan-700 hover:underline">{po.itemId}</Link></td><td><Link href={`/projects/${po.project}`} className="text-cyan-700 hover:underline">{po.project}</Link></td><td>{po.qtyOrdered}</td><td>{po.orderDate ?? '-'}</td><td>{po.expectedDelivery ?? '-'}</td><td><StatusChip value={po.status} /></td><td>{poDaysLate(po)}</td></tr>)}</tbody></DataTable></div>;
}
