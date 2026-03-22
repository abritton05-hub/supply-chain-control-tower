import Link from 'next/link';
import { notFound } from 'next/navigation';
import { DataTable } from '@/components/data-table';
import { purchaseOrders, transactions } from '@/lib/data/mock-data';

export default function PODetailPage({ params }: { params: { poNumber: string } }) {
  const po = purchaseOrders.find((row) => row.poNumber === params.poNumber);
  if (!po) return notFound();
  const poTransactions = transactions.filter((t) => t.reference === po.poNumber || t.itemId === po.itemId);

  return <div className="space-y-3"><div className="erp-card p-4"><div className="flex items-start justify-between gap-3"><div><h2 className="text-lg font-semibold">{po.poNumber}</h2><p className="text-sm text-slate-600">{po.vendor} · {po.status} · {po.itemId}</p></div><div className="flex gap-2 text-xs"><button className="rounded border border-slate-300 px-2 py-1">Edit PO</button><button className="rounded border border-slate-300 px-2 py-1">Archive PO</button></div></div><div className="mt-3 grid gap-2 text-xs md:grid-cols-3"><p><span className="font-semibold">Vendor:</span> <Link className="text-cyan-700 hover:underline" href={`/vendors/${po.vendor === 'Apex Electronics' ? 'v1' : po.vendor === 'PowerGrid Supply' ? 'v2' : 'v3'}`}>{po.vendor}</Link></p><p><span className="font-semibold">Item:</span> <Link className="text-cyan-700 hover:underline" href={`/inventory/${po.itemId}`}>{po.itemId}</Link></p><p><span className="font-semibold">Project:</span> <Link className="text-cyan-700 hover:underline" href={`/projects-builds/${po.project}`}>{po.project}</Link></p><p><span className="font-semibold">Qty Ordered:</span> {po.qtyOrdered}</p><p><span className="font-semibold">Order Date:</span> {po.orderDate}</p><p><span className="font-semibold">Expected Delivery:</span> {po.expectedDelivery}</p></div></div><DataTable><thead><tr>{['Date/Time','Type','Item','Qty','From','To','User','Notes'].map((h)=><th key={h}>{h}</th>)}</tr></thead><tbody>{poTransactions.map((t)=><tr key={t.id}><td>{t.performedAt}</td><td>{t.movementType}</td><td><Link className="text-cyan-700 hover:underline" href={`/inventory/${t.itemId}`}>{t.itemId}</Link></td><td>{t.quantity}</td><td>{t.fromLocation}</td><td>{t.toLocation}</td><td><Link className="text-cyan-700 hover:underline" href={`/users/${t.performedByUserId}`}>{t.performedByName}</Link></td><td>{t.notes}</td></tr>)}</tbody></DataTable></div>;
}
