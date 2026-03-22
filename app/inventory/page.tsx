'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { DataTable } from '@/components/data-table';
import { FilterBar } from '@/components/filter-bar';
import { KpiCard } from '@/components/kpi-card';
import { SearchInput } from '@/components/search-input';
import { SectionHeader } from '@/components/section-header';
import { StatusChip } from '@/components/status-chip';
import { ConfirmDialog, SlideOver } from '@/components/overlay-ui';
import { useInventoryStore } from '@/lib/state/mock-client-db';
import { inventoryMetrics } from '@/lib/logic';
import { InventoryItem } from '@/lib/types/domain';

const blank: InventoryItem = { id: 'new', itemId: '', itemName: '', description: '', trackingType: 'SERIALIZED', serialRequired: true, autoGenerateSerials: true, nextSerialNumber: 1, inventoryType: 'RAW', currentInventory: 0, averageDailyUsage: 0, leadTimeDays: 1, safetyStock: 0, preferredVendor: '', department: 'Assembly', criticality: 'NORMAL' };

export default function InventoryPage() {
  const [items, setItems] = useInventoryStore();
  const [query, setQuery] = useState('');
  const [critical, setCritical] = useState('ALL');
  const [view, setView] = useState('All');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<InventoryItem | null>(null);
  const [draft, setDraft] = useState<InventoryItem>(blank);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const rows = useMemo(() => items.map((item) => ({ ...item, ...inventoryMetrics(item) })).filter((item) => `${item.itemId} ${item.itemName} ${item.description}`.toLowerCase().includes(query.toLowerCase()) && (critical === 'ALL' || item.criticality === critical)), [items, critical, query]);

  const startAdd = () => { setEditing(null); setDraft({ ...blank, id: `i-${Date.now()}` }); setOpen(true); };
  const startEdit = (item: InventoryItem) => { setEditing(item); setDraft(item); setOpen(true); };
  const save = () => {
    if (editing) setItems((prev) => prev.map((p) => (p.id === editing.id ? draft : p)));
    else setItems((prev) => [...prev, draft]);
    setOpen(false);
  };

  return (
    <div>
      <SectionHeader title="Inventory Database" subtitle="Operational inventory visibility with reorder and risk logic" actions={<button onClick={startAdd} className="rounded border border-slate-300 bg-white px-2 py-1 text-xs">Add Inventory</button>} />
      <div className="mb-4 grid gap-4 md:grid-cols-4">
        <KpiCard label="Filtered Items" value={rows.length} />
        <KpiCard label="Reorder Needed" value={rows.filter((r) => r.reorderNeeded === 'YES').length} />
        <KpiCard label="View" value={view} />
        <KpiCard label="Critical Filter" value={critical} />
      </div>
      <FilterBar>
        <SearchInput value={query} onChange={setQuery} placeholder="Search Item ID, Name, Description" />
        <select className="rounded border border-slate-300 px-2 text-sm" value={critical} onChange={(e) => setCritical(e.target.value)}><option value="ALL">Critical: All</option><option>CRITICAL</option><option>HIGH</option><option>NORMAL</option><option>LOW</option></select>
        <select className="rounded border border-slate-300 px-2 text-sm" value={view} onChange={(e) => setView(e.target.value)}><option>All</option><option>Warehouse A</option><option>Warehouse B</option></select>
      </FilterBar>
      <DataTable>
        <thead><tr>{['Select','Item ID','Item Name','Description','Tracking Type','Current Quantity','Safety Stock','Qty Above Safety','Lead Time Days','Reorder Point','Days Cover','Next Order Date','Preferred Vendor','Department','Priority','Risk Score','Actions'].map((h)=><th key={h}>{h}</th>)}</tr></thead>
        <tbody>{rows.map((item) => <tr key={item.id}><td><input type="checkbox" /></td><td className="font-semibold"><Link href={`/inventory/${item.itemId}`} className="text-cyan-700 hover:underline">{item.itemId}</Link></td><td>{item.itemName}</td><td>{item.description}</td><td>{item.trackingType}</td><td>{item.currentInventory}</td><td>{item.safetyStock}</td><td>{item.quantityAboveSafetyStock}</td><td>{item.leadTimeDays}</td><td>{item.reorderPoint}</td><td>{item.daysCover.toFixed(1)}</td><td>{item.nextSuggestedOrderDate}</td><td>{item.preferredVendor}</td><td>{item.department}</td><td><StatusChip value={item.priority} /></td><td>{item.riskScore}</td><td><div className="flex gap-1"><button onClick={() => startEdit(item)} className="rounded border border-slate-300 px-2 py-0.5 text-xs">Edit</button><button onClick={() => setConfirmId(item.id)} className="rounded border border-rose-300 px-2 py-0.5 text-xs text-rose-700">Delete</button></div></td></tr>)}</tbody>
      </DataTable>

      <SlideOver open={open} title={editing ? `Edit Inventory ${editing.itemId}` : 'Add Inventory'} onClose={() => setOpen(false)}>
        <div className="grid gap-2 md:grid-cols-2">
          <input value={draft.itemId} onChange={(e) => setDraft({ ...draft, itemId: e.target.value })} className="rounded border border-slate-300 px-2 py-1 text-sm" placeholder="Item ID" />
          <input value={draft.itemName} onChange={(e) => setDraft({ ...draft, itemName: e.target.value })} className="rounded border border-slate-300 px-2 py-1 text-sm" placeholder="Item Name" />
          <input value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} className="rounded border border-slate-300 px-2 py-1 text-sm" placeholder="Description" />
          <select value={draft.trackingType} onChange={(e) => setDraft({ ...draft, trackingType: e.target.value as InventoryItem['trackingType'] })} className="rounded border border-slate-300 px-2 py-1 text-sm"><option>SERIALIZED</option><option>LOT</option><option>QUANTITY</option></select>
          <select value={draft.inventoryType} onChange={(e) => setDraft({ ...draft, inventoryType: e.target.value as InventoryItem['inventoryType'] })} className="rounded border border-slate-300 px-2 py-1 text-sm"><option>RAW</option><option>WIP</option><option>FG</option><option>MRO</option></select>
          <input type="number" value={draft.currentInventory} onChange={(e) => setDraft({ ...draft, currentInventory: Number(e.target.value) })} className="rounded border border-slate-300 px-2 py-1 text-sm" placeholder="Current Quantity" />
          <input type="number" value={draft.safetyStock} onChange={(e) => setDraft({ ...draft, safetyStock: Number(e.target.value) })} className="rounded border border-slate-300 px-2 py-1 text-sm" placeholder="Safety Stock" />
          <input type="number" value={draft.averageDailyUsage} onChange={(e) => setDraft({ ...draft, averageDailyUsage: Number(e.target.value) })} className="rounded border border-slate-300 px-2 py-1 text-sm" placeholder="Average Daily Usage" />
          <input type="number" value={draft.leadTimeDays} onChange={(e) => setDraft({ ...draft, leadTimeDays: Number(e.target.value) })} className="rounded border border-slate-300 px-2 py-1 text-sm" placeholder="Lead Time Days" />
          <input value={draft.preferredVendor} onChange={(e) => setDraft({ ...draft, preferredVendor: e.target.value })} className="rounded border border-slate-300 px-2 py-1 text-sm" placeholder="Preferred Vendor" />
          <select value={draft.department} onChange={(e) => setDraft({ ...draft, department: e.target.value as InventoryItem['department'] })} className="rounded border border-slate-300 px-2 py-1 text-sm"><option>Assembly</option><option>Warehouse</option><option>Service</option><option>Engineering</option></select>
          <input className="rounded border border-slate-300 px-2 py-1 text-sm" placeholder="COGS / Standard Cost" />
          <input className="rounded border border-slate-300 px-2 py-1 text-sm" placeholder="Order Method" defaultValue="PO" />
          <select className="rounded border border-slate-300 px-2 py-1 text-sm"><option>Credit Card Allowed: YES</option><option>Credit Card Allowed: NO</option></select>
          <select className="rounded border border-slate-300 px-2 py-1 text-sm"><option>PO Required: YES</option><option>PO Required: NO</option></select>
          <input className="rounded border border-slate-300 px-2 py-1 text-sm" placeholder="Expiration Date (optional)" />
        </div>
        <div className="mt-4 flex gap-2"><button onClick={save} className="rounded border border-cyan-700 bg-cyan-50 px-3 py-1 text-xs text-cyan-800">Save</button><button onClick={() => setOpen(false)} className="rounded border border-slate-300 px-3 py-1 text-xs">Cancel</button></div>
      </SlideOver>

      <ConfirmDialog open={!!confirmId} title="Delete Inventory Record" message="Are you sure you want to remove this inventory record from local state?" onCancel={() => setConfirmId(null)} onConfirm={() => { setItems((prev) => prev.filter((p) => p.id !== confirmId)); setConfirmId(null); }} />
    </div>
  );
}
