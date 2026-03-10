import { notFound } from 'next/navigation';
import { inventoryItems } from '@/lib/data/mock-data';

export default function InventoryItemPage({ params }: { params: { itemId: string } }) {
  const item = inventoryItems.find((row) => row.itemId === params.itemId);
  if (!item) return notFound();
  return <div className="erp-card p-4"><h2 className="text-lg font-semibold">{item.itemId}</h2><p className="text-sm text-slate-600">{item.itemName} · {item.description}</p></div>;
}
