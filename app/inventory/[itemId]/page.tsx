import { notFound } from 'next/navigation';
import { ItemDetailTabs } from '@/components/item-detail-tabs';
import { KpiCard } from '@/components/kpi-card';
import { inventoryItems, vendors } from '@/lib/data/mock-data';
import { inventoryMetrics } from '@/lib/logic';

export default function InventoryItemPage({ params }: { params: { itemId: string } }) {
  const item = inventoryItems.find((row) => row.itemId === params.itemId);
  if (!item) return notFound();

  const metrics = inventoryMetrics(item);
  const pref = vendors.find((v) => v.vendorName === item.preferredVendor);
  const alt = vendors.find((v) => v.vendorName !== item.preferredVendor);

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
        <div className="mt-3 grid gap-2 text-xs md:grid-cols-3 xl:grid-cols-5">
          <p><span className="font-semibold">Internal Part Number:</span> INT-{item.itemId}</p>
          <p><span className="font-semibold">Vendor Part Number:</span> {pref ? `${pref.id.toUpperCase()}-${item.itemId}` : '-'}</p>
          <p><span className="font-semibold">Tracking Type:</span> {item.trackingType}</p>
          <p><span className="font-semibold">Inventory Type:</span> {item.inventoryType}</p>
          <p><span className="font-semibold">Preferred Vendor:</span> {item.preferredVendor}</p>
          <p><span className="font-semibold">Alternate Vendor:</span> {alt?.vendorName ?? '-'}</p>
          <p><span className="font-semibold">Department:</span> {item.department}</p>
          <p><span className="font-semibold">Criticality:</span> {item.criticality}</p>
          <p><span className="font-semibold">Serial Required:</span> {item.serialRequired ? 'YES' : 'NO'}</p>
          <p><span className="font-semibold">Auto Generate Serials:</span> {item.autoGenerateSerials ? 'YES' : 'NO'}</p>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Current Quantity" value={item.currentInventory} />
        <KpiCard label="Safety Stock" value={item.safetyStock} />
        <KpiCard label="Quantity Above Safety" value={metrics.quantityAboveSafetyStock} />
        <KpiCard label="Reorder Point" value={metrics.reorderPoint} />
        <KpiCard label="Days Cover" value={metrics.daysCover.toFixed(1)} />
        <KpiCard label="Suggested Order Qty" value={metrics.suggestedOrderQty} />
        <KpiCard label="Next Order Date" value={metrics.nextSuggestedOrderDate} />
        <KpiCard label="Last Received Date" value={metrics.projectedStockoutDate} />
      </div>

      <ItemDetailTabs itemId={item.itemId} />
    </div>
  );
}
