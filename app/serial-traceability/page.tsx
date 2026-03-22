'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { DataTable } from '@/components/data-table';
import { FilterBar } from '@/components/filter-bar';
import { SearchInput } from '@/components/search-input';
import { SectionHeader } from '@/components/section-header';
import { StatusChip } from '@/components/status-chip';
import { useSerialsStore } from '@/lib/state/mock-client-db';

export default function SerialTraceabilityPage() {
  const [serialRecords] = useSerialsStore();
  const [query, setQuery] = useState('');
  const [project, setProject] = useState('ALL');
  const [customer, setCustomer] = useState('ALL');
  const [status, setStatus] = useState('ALL');
  const rows = useMemo(() => serialRecords.filter((s) => (s.serialNumber.toLowerCase().includes(query.toLowerCase()) && (project === 'ALL' || s.project === project) && (customer === 'ALL' || s.customer === customer) && (status === 'ALL' || s.status === status))), [query, project, customer, status, serialRecords]);
  return (<div><SectionHeader title="Serial Traceability" subtitle="Door-in to door-out serialized audit view" /><FilterBar><SearchInput value={query} onChange={setQuery} placeholder="Search serial number" /><select className="rounded border border-slate-300 px-2 text-sm" value={project} onChange={(e)=>setProject(e.target.value)}><option value="ALL">Project: All</option>{[...new Set(serialRecords.map((r)=>r.project))].map((p)=><option key={p}>{p}</option>)}</select><select className="rounded border border-slate-300 px-2 text-sm" value={customer} onChange={(e)=>setCustomer(e.target.value)}><option value="ALL">Customer: All</option>{[...new Set(serialRecords.map((r)=>r.customer))].map((c)=><option key={c}>{c}</option>)}</select><select className="rounded border border-slate-300 px-2 text-sm" value={status} onChange={(e)=>setStatus(e.target.value)}><option value="ALL">Status: All</option>{[...new Set(serialRecords.map((r)=>r.status))].map((st)=><option key={st}>{st}</option>)}</select></FilterBar><div className="erp-card mb-3 p-3 text-xs"><span className="font-semibold">Serial Settings:</span> Prefix DAI · Separator - · Starting Number 1 · Padding 5 · Auto-generate on receive YES · Manual override YES · Uniqueness required YES</div><DataTable><thead><tr>{['Serial Number','Item ID','Description','PO Number','Project','Date Received','Current Location','Work Order','Build Status','Date Shipped','Tracking Number','Customer','Status'].map((h)=><th key={h}>{h}</th>)}</tr></thead><tbody>{rows.map((r)=><tr key={r.serialNumber}><td><Link href={`/serial-traceability/${r.serialNumber}`} className="text-cyan-700 font-semibold hover:underline">{r.serialNumber}</Link></td><td><Link href={`/inventory/${r.itemId}`} className="text-cyan-700 hover:underline">{r.itemId}</Link></td><td>{r.description}</td><td><Link href={`/open-pos/${r.poNumber}`} className="text-cyan-700 hover:underline">{r.poNumber}</Link></td><td><Link href={`/projects-builds/${r.project}`} className="text-cyan-700 hover:underline">{r.project}</Link></td><td>{r.dateReceived}</td><td>{r.currentLocation}</td><td>{r.workOrder}</td><td>{r.buildStatus}</td><td>{r.dateShipped ?? '-'}</td><td>{r.trackingNumber ?? '-'}</td><td>{r.customer}</td><td><StatusChip value={r.status} /></td></tr>)}</tbody></DataTable></div>);
}
