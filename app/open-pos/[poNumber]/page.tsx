import { notFound } from 'next/navigation';
import { purchaseOrders } from '@/lib/data/mock-data';

export default function PODetailPage({ params }: { params: { poNumber: string } }) {
  const po = purchaseOrders.find((row) => row.poNumber === params.poNumber);
  if (!po) return notFound();
  return <div className="erp-card p-4"><h2 className="text-lg font-semibold">{po.poNumber}</h2><p className="text-sm text-slate-600">{po.vendor} · {po.status} · {po.itemId}</p></div>;
}
