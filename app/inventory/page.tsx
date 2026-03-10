'use client';

import { useMemo, useState } from 'react';
<<<<<<< HEAD
import Link from 'next/link';
=======
>>>>>>> origin/main
import { DataTable } from '@/components/data-table';
import { FilterBar } from '@/components/filter-bar';
import { KpiCard } from '@/components/kpi-card';
import { SearchInput } from '@/components/search-input';
import { SectionHeader } from '@/components/section-header';
import { StatusChip } from '@/components/status-chip';
import { inventoryItems } from '@/lib/data/mock-data';
import { inventoryMetrics } from '@/lib/logic';

export default function InventoryPage() {
  const [query, setQuery] = useState('');
  const [critical, setCritical] = useState('ALL');
  const [reorder, setReorder] = useState('ALL');
  const [tracking, setTracking] = useState('ALL');
  const [department, setDepartment] = useState('ALL');

  const rows = useMemo(
    () =>
      inventoryItems
        .map((item) => ({ ...item, ...inventoryMetrics(item) }))
        .filter((item) => {
          const searchPass = `${item.itemId} ${item.itemName} ${item.description}`.toLowerCase().includes(query.toLowerCase());
          const criticalPass = critical === 'ALL' || item.criticality === critical;
          const reorderPass = reorder === 'ALL' || item.reorderNeeded === reorder;
          const trackingPass = tracking === 'ALL' || item.trackingType === tracking;
          const departmentPass = department === 'ALL' || item.department === department;
          return searchPass && criticalPass && reorderPass && trackingPass && departmentPass;
        }),
    [critical, department, query, reorder, tracking],
  );

  const reorderCount = rows.filter((r) => r.reorderNeeded === 'YES').length;

  return (
    <div>
<<<<<<< HEAD
      <SectionHeader title="Inventory Database" subtitle="Operational inventory visibility with reorder and risk logic" actions={<button className="rounded border border-slate-300 bg-white px-2 py-1 text-xs">Add Inventory</button>} />
=======
      <SectionHeader title="Inventory Database" subtitle="Operational inventory visibility with reorder and risk logic" />
>>>>>>> origin/main
      <div className="erp-banner">
        <p className="text-sm font-semibold">Inventory command view</p>
        <p className="text-xs text-slate-200">Computed planning fields are live from current usage, lead time, and safety stock assumptions.</p>
      </div>
      <div className="mb-4 grid gap-4 md:grid-cols-4">
        <KpiCard label="Filtered Items" value={rows.length} />
        <KpiCard label="Need Reorder" value={reorderCount} />
        <KpiCard label="Critical Filter" value={critical} />
        <KpiCard label="Department Filter" value={department} />
      </div>
      <FilterBar>
        <SearchInput value={query} onChange={setQuery} placeholder="Search Item ID, Name, Description" />
        <select className="rounded border border-slate-300 px-2 text-sm" value={critical} onChange={(e) => setCritical(e.target.value)}><option value="ALL">Critical: All</option><option>CRITICAL</option><option>HIGH</option><option>NORMAL</option><option>LOW</option></select>
        <select className="rounded border border-slate-300 px-2 text-sm" value={reorder} onChange={(e) => setReorder(e.target.value)}><option value="ALL">Reorder: All</option><option>YES</option><option>OK</option></select>
<<<<<<< HEAD
        <select className="rounded border border-slate-300 px-2 text-sm" value={tracking} onChange={(e) => setTracking(e.target.value)}><option value="ALL">Tracking: All</option><option>SERIALIZED</option><option>LOT</option><option>QUANTITY</option></select>
=======
        <select className="rounded border border-slate-300 px-2 text-sm" value={tracking} onChange={(e) => setTracking(e.target.value)}><option value="ALL">Tracking: All</option><option>SERIAL</option><option>LOT</option><option>QTY</option></select>
>>>>>>> origin/main
        <select className="rounded border border-slate-300 px-2 text-sm" value={department} onChange={(e) => setDepartment(e.target.value)}><option value="ALL">Department: All</option><option>Assembly</option><option>Warehouse</option><option>Service</option><option>Engineering</option></select>
      </FilterBar>
      <DataTable>
        <thead><tr>{['Item ID','Item Name','Description','Tracking Type','Inventory Type','Current Inventory','Average Daily Usage','Lead Time Days','Safety Stock','Qty Above Safety','Reorder Point','Reorder Needed','Days Cover','Projected Stockout Date','Next Suggested Order Date','Suggested Order Qty','Priority','Risk Score','Critical','Preferred Vendor','Department'].map((h)=><th key={h}>{h}</th>)}</tr></thead>
        <tbody>
          {rows.map((item) => (
            <tr key={item.itemId} className={item.reorderNeeded === 'YES' ? 'bg-rose-50' : ''}>
<<<<<<< HEAD
              <td className="font-semibold"><Link href={`/inventory/${item.itemId}`} className="text-cyan-700 hover:underline">{item.itemId}</Link></td><td>{item.itemName}</td><td>{item.description}</td><td>{item.trackingType}</td><td>{item.inventoryType}</td><td>{item.currentInventory}</td><td>{item.averageDailyUsage}</td><td>{item.leadTimeDays}</td><td>{item.safetyStock}</td><td className={item.quantityAboveSafetyStock <= 0 ? 'text-rose-700 font-semibold' : ''}>{item.quantityAboveSafetyStock}</td><td>{item.reorderPoint}</td><td><StatusChip value={item.reorderNeeded} /></td><td>{item.daysCover.toFixed(1)}</td><td>{item.projectedStockoutDate}</td><td>{item.nextSuggestedOrderDate}</td><td>{item.suggestedOrderQty}</td><td><StatusChip value={item.priority} /></td><td>{item.riskScore}</td><td><StatusChip value={item.criticality} /></td><td><Link href={`/vendors/${item.preferredVendor === 'Apex Electronics' ? 'v1' : item.preferredVendor === 'PowerGrid Supply' ? 'v2' : 'v3'}`} className="text-cyan-700 hover:underline">{item.preferredVendor}</Link></td><td>{item.department}</td>
=======
              <td className="font-semibold">{item.itemId}</td><td>{item.itemName}</td><td>{item.description}</td><td>{item.trackingType}</td><td>{item.inventoryType}</td><td>{item.currentInventory}</td><td>{item.averageDailyUsage}</td><td>{item.leadTimeDays}</td><td>{item.safetyStock}</td><td className={item.quantityAboveSafetyStock <= 0 ? 'text-rose-700 font-semibold' : ''}>{item.quantityAboveSafetyStock}</td><td>{item.reorderPoint}</td><td><StatusChip value={item.reorderNeeded} /></td><td>{item.daysCover.toFixed(1)}</td><td>{item.projectedStockoutDate}</td><td>{item.nextSuggestedOrderDate}</td><td>{item.suggestedOrderQty}</td><td><StatusChip value={item.priority} /></td><td>{item.riskScore}</td><td><StatusChip value={item.criticality} /></td><td>{item.preferredVendor}</td><td>{item.department}</td>
>>>>>>> origin/main
            </tr>
          ))}
        </tbody>
      </DataTable>
    </div>
  );
}
