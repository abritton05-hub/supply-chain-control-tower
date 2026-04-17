import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ItemDetailTabs } from '@/components/item-detail-tabs';
import { inventoryItems } from '@/lib/data/mock-data';
import { inventoryMetrics } from '@/lib/logic';

export default function InventoryItemPage({ params }: { params: { itemId: string } }) {
  const item = inventoryItems.find((row) => row.itemId === params.itemId);
  if (!item) return notFound();

  const metrics = inventoryMetrics(item);

  return (
    <div className="space-y-3">
      <div className="erp-card p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">{item.itemId} · {item.itemName}</h2>
            <p className="text-sm text-slate-600">{item.description}</p>
          </div>
          <div className="flex gap-2 text-xs">
            <button className="rounded border border-slate-300 px-2 py-1">Edit</button>
            <button className="rounded border border-slate-300 px-2 py-1">Archive</button>
            <button className="rounded border border-slate-300 px-2 py-1">Delete</button>
          </div>
        </div>
        <div className="mt-3 grid gap-2 text-xs md:grid-cols-3 xl:grid-cols-6">
          <p><span className="font-semibold">Tracking:</span> {item.trackingType}</p>
          <p><span className="font-semibold">Inventory Type:</span> {item.inventoryType}</p>
          <p><span className="font-semibold">Current Qty:</span> {item.currentInventory}</p>
          <p><span className="font-semibold">Safety Stock:</span> {item.safetyStock}</p>
          <p><span className="font-semibold">Qty Above Safety:</span> {metrics.quantityAboveSafetyStock}</p>
          <p><span className="font-semibold">Next Order Date:</span> {metrics.nextSuggestedOrderDate}</p>
          <p><span className="font-semibold">Preferred Vendor:</span> <Link href="/vendors" className="text-cyan-700 hover:underline">{item.preferredVendor}</Link></p>
          <p><span className="font-semibold">Lead Time Days:</span> {item.leadTimeDays}</p>
          <p><span className="font-semibold">Reorder Point:</span> {metrics.reorderPoint}</p>
          <p><span className="font-semibold">Order Method:</span> PO</p>
          <p><span className="font-semibold">Credit Card Allowed:</span> YES</p>
          <p><span className="font-semibold">PO Required:</span> YES</p>
        </div>
      </div>

      <ItemDetailTabs itemId={item.itemId} />
    </div>
  );
}
