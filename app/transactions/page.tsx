'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { DataTable } from '@/components/data-table';
import { FilterBar } from '@/components/filter-bar';
import { KpiCard } from '@/components/kpi-card';
import { SearchInput } from '@/components/search-input';
import { SectionHeader } from '@/components/section-header';
import { StatusChip } from '@/components/status-chip';
import { inventoryItems, purchaseOrders, shipmentLog, transactions } from '@/lib/data/mock-data';

const views = ['All Transactions', 'Receipts', 'Issues', 'Transfers', 'Adjustments', 'Serial Movements', 'User Activity'] as const;

export default function TransactionsPage() {
  const [query, setQuery] = useState('');
  const [view, setView] = useState<(typeof views)[number]>('All Transactions');

  const rows = useMemo(() => transactions.filter((t) => {
    const q = `${t.itemId} ${t.serialNumber} ${t.reference} ${t.performedByName}`.toLowerCase().includes(query.toLowerCase());
    if (!q) return false;
    if (view === 'All Transactions') return true;
    if (view === 'Receipts') return t.movementType === 'RECEIPT';
    if (view === 'Issues') return t.movementType === 'ISSUE' || t.movementType === 'BUILD ISSUE';
    if (view === 'Transfers') return t.movementType === 'TRANSFER' || t.movementType === 'LOCATION MOVE';
    if (view === 'Adjustments') return t.movementType === 'ADJUSTMENT' || t.movementType === 'CYCLE COUNT';
    if (view === 'Serial Movements') return t.serialNumber !== '-';
    return true;
  }), [query, view]);

  return (
    <div className="space-y-4">
      <SectionHeader title="Inventory Transactions" subtitle="Immutable ERP transaction ledger with drill-down traceability" />
      <div className="grid gap-4 md:grid-cols-4">
        <KpiCard label="Visible Transactions" value={rows.length} />
        <KpiCard label="Receipts" value={rows.filter((r) => r.movementType === 'RECEIPT').length} />
        <KpiCard label="Issues" value={rows.filter((r) => r.movementType === 'ISSUE' || r.movementType === 'BUILD ISSUE').length} />
        <KpiCard label="Serial Movements" value={rows.filter((r) => r.serialNumber !== '-').length} />
      </div>
      <FilterBar>
        <SearchInput value={query} onChange={setQuery} placeholder="Search item, serial, reference, user" />
        <select className="rounded border border-slate-300 px-2 text-sm" value={view} onChange={(e) => setView(e.target.value as (typeof views)[number])}>{views.map((v) => <option key={v}>{v}</option>)}</select>
      </FilterBar>
      <DataTable>
        <thead><tr>{['Transaction ID','Date/Time','Transaction Type','Item ID','Item Name','Serial Number','Quantity','UOM','From Location','To Location','Vendor','Customer','PO Number','Project ID','Work Order','Shipment ID','Department','Reason Code','Notes','Performed By','Performed At'].map((h)=><th key={h}>{h}</th>)}</tr></thead>
        <tbody>{rows.map((r)=>{const item=inventoryItems.find((i)=>i.itemId===r.itemId); const po=r.reference.startsWith('PO-')?r.reference:'-'; const ship=shipmentLog.find((s)=>s.serialNumber===r.serialNumber || s.itemId===r.itemId); return <tr key={r.id}><td>{r.id}</td><td>{r.date}</td><td><StatusChip value={r.movementType} /></td><td><Link href={`/inventory/${r.itemId}`} className="text-cyan-700 hover:underline">{r.itemId}</Link></td><td>{item?.itemName ?? '-'}</td><td>{r.serialNumber!=='-'?<Link href={`/serial-traceability/${r.serialNumber}`} className="text-cyan-700 hover:underline">{r.serialNumber}</Link>:'-'}</td><td>{r.quantity}</td><td>EA</td><td>{r.fromLocation}</td><td>{r.toLocation}</td><td>{po !== '-' ? purchaseOrders.find((p) => p.poNumber === po)?.vendor ?? '-' : '-'}</td><td>{ship?.customer ?? '-'}</td><td>{po!=='-'?<Link href={`/open-pos/${po}`} className="text-cyan-700 hover:underline">{po}</Link>:'-'}</td><td>{r.reference.startsWith('PRJ-') ? <Link href={`/projects-builds/${r.reference}`} className="text-cyan-700 hover:underline">{r.reference}</Link> : '-'}</td><td>{r.workOrder}</td><td>{ship ? <Link href={`/shipment-log/${ship.id}`} className="text-cyan-700 hover:underline">{ship.id}</Link> : '-'}</td><td>{item?.department ?? '-'}</td><td>{r.movementType}</td><td>{r.notes}</td><td>{r.performedByName}</td><td>{r.performedAt}</td></tr>;})}</tbody>
      </DataTable>
    </div>
  );
}
