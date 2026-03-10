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
import { transactions } from '@/lib/data/mock-data';

export default function TransactionsPage() {
  const [query, setQuery] = useState('');
  const [type, setType] = useState('ALL');

  const rows = useMemo(
<<<<<<< HEAD
    () => transactions.filter((t) => `${t.itemId} ${t.serialNumber} ${t.reference} ${t.performedByName}`.toLowerCase().includes(query.toLowerCase()) && (type === 'ALL' || t.movementType === type)),
=======
    () => transactions.filter((t) => `${t.itemId} ${t.serialNumber} ${t.reference} ${t.employee}`.toLowerCase().includes(query.toLowerCase()) && (type === 'ALL' || t.transactionType === type)),
>>>>>>> origin/main
    [query, type],
  );

  return (
    <div className="space-y-4">
<<<<<<< HEAD
      <SectionHeader title="Inventory Transactions" subtitle="User-attributed movement history and immutable audit trail" />
      <div className="grid gap-4 md:grid-cols-3">
        <KpiCard label="Visible Transactions" value={rows.length} />
        <KpiCard label="Receipts" value={rows.filter((r) => r.movementType === 'RECEIPT').length} />
        <KpiCard label="Issues" value={rows.filter((r) => r.movementType === 'ISSUE').length} />
      </div>
      <FilterBar>
        <SearchInput value={query} onChange={setQuery} placeholder="Search item, serial, reference, user" />
        <select className="rounded border border-slate-300 px-2 text-sm" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="ALL">Type: All</option><option>RECEIPT</option><option>ISSUE</option><option>TRANSFER</option><option>ADJUSTMENT</option><option>CYCLE COUNT</option><option>BUILD ISSUE</option><option>BUILD COMPLETE</option><option>SHIP</option><option>RETURN</option><option>SCRAP</option><option>LOCATION MOVE</option>
        </select>
      </FilterBar>
      <DataTable>
        <thead><tr>{['Date','Item ID','Serial Number','Movement Type','Quantity','From Location','To Location','Reference','Work Order','Performed By','Role','Performed At','Notes'].map((h)=><th key={h}>{h}</th>)}</tr></thead>
        <tbody>{rows.map((r)=><tr key={r.id}><td>{r.date}</td><td><Link href={`/inventory/${r.itemId}`} className="text-cyan-700 hover:underline">{r.itemId}</Link></td><td>{r.serialNumber !== '-' ? <Link href={`/serial-traceability/${r.serialNumber}`} className="text-cyan-700 hover:underline">{r.serialNumber}</Link> : '-'}</td><td><StatusChip value={r.movementType} /></td><td>{r.quantity}</td><td>{r.fromLocation}</td><td>{r.toLocation}</td><td>{r.reference.startsWith('PO-') ? <Link href={`/open-pos/${r.reference}`} className="text-cyan-700 hover:underline">{r.reference}</Link> : r.reference}</td><td>{r.workOrder}</td><td>{r.performedByName}</td><td>{r.performedByRole}</td><td>{r.performedAt}</td><td>{r.notes}</td></tr>)}</tbody>
=======
      <SectionHeader title="Inventory Transactions" subtitle="Movement history and transaction audit trail" />
      <div className="grid gap-4 md:grid-cols-3">
        <KpiCard label="Visible Transactions" value={rows.length} />
        <KpiCard label="Receipts" value={rows.filter((r) => r.transactionType === 'RECEIVED').length} />
        <KpiCard label="Issues" value={rows.filter((r) => r.transactionType === 'ISSUED').length} />
      </div>
      <FilterBar>
        <SearchInput value={query} onChange={setQuery} placeholder="Search item, serial, PO/Project, employee" />
        <select className="rounded border border-slate-300 px-2 text-sm" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="ALL">Type: All</option><option>RECEIVED</option><option>TRANSFER</option><option>ISSUED</option><option>ADJUSTMENT</option><option>BUILT</option><option>SHIPPED</option><option>COUNT</option>
        </select>
      </FilterBar>
      <DataTable>
        <thead><tr>{['Date','Item ID','Serial Number','Transaction Type','Quantity','From Location','To Location','PO / Project','Work Order','Employee','Notes'].map((h)=><th key={h}>{h}</th>)}</tr></thead>
        <tbody>{rows.map((r, i)=><tr key={i}><td>{r.date}</td><td>{r.itemId}</td><td>{r.serialNumber}</td><td><StatusChip value={r.transactionType} /></td><td>{r.quantity}</td><td>{r.fromLocation}</td><td>{r.toLocation}</td><td>{r.reference}</td><td>{r.workOrder}</td><td>{r.employee}</td><td>{r.notes}</td></tr>)}</tbody>
>>>>>>> origin/main
      </DataTable>
    </div>
  );
}
