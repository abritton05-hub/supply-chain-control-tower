'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { DataTable } from '@/components/data-table';
import { SectionHeader } from '@/components/section-header';
import { ConfirmDialog, Modal } from '@/components/overlay-ui';
import { useFreightQuotesStore } from '@/lib/state/mock-client-db';
import { FreightQuote } from '@/lib/types/domain';

type ServiceType = 'Rail' | 'LTL' | 'Full Truckload';
type QuoteDraft = FreightQuote & { serviceType: ServiceType };

const blank: QuoteDraft = { id: 'new', quoteId: '', date: '', originZip: '', destinationZip: '', miles: 0, weight: 0, palletCount: 0, serviceType: 'LTL' };

function calc(d: QuoteDraft) {
  const base = d.serviceType === 'Rail' ? 0.9 : d.serviceType === 'Full Truckload' ? 1.35 : 1.1;
  const avgRaw = d.miles * base + d.weight * 0.06 + d.palletCount * 28;
  const low = Math.round(avgRaw * 0.88);
  const avg = Math.round(avgRaw);
  const high = Math.round(avgRaw * 1.18);
  const costPerMile = d.miles ? (avg / d.miles).toFixed(2) : '0.00';
  const costPerLb = d.weight ? (avg / d.weight).toFixed(2) : '0.00';
  return { low, avg, high, costPerMile, costPerLb };
}

function fromStored(quote: FreightQuote): QuoteDraft {
  return { ...quote, serviceType: quote.serviceType === 'FTL' ? 'Full Truckload' : quote.serviceType } as QuoteDraft;
}

function toStored(quote: QuoteDraft): FreightQuote {
  return { ...quote, serviceType: quote.serviceType === 'Full Truckload' ? 'FTL' : quote.serviceType } as FreightQuote;
}

export default function FreightQuotesPage() {
  const [quotesStore, setQuotesStore] = useFreightQuotesStore();
  const quotes = useMemo(() => quotesStore.map(fromStored), [quotesStore]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<QuoteDraft | null>(null);
  const [draft, setDraft] = useState<QuoteDraft>(blank);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const computed = useMemo(() => calc(draft), [draft]);
  const startAdd = () => { setEditing(null); setDraft({ ...blank, id: `f-${Date.now()}` }); setOpen(true); };
  const startEdit = (q: QuoteDraft) => { setEditing(q); setDraft(q); setOpen(true); };
  const save = () => {
    if (editing) setQuotesStore((prev) => prev.map((q) => (q.id === editing.id ? toStored(draft) : q)));
    else setQuotesStore((prev) => [...prev, toStored(draft)]);
    setOpen(false);
  };

  return <div className="space-y-3"><SectionHeader title="Freight Quotes" subtitle="Quick quote matrix with low / average / high estimate bands" actions={<button onClick={startAdd} className="rounded border border-slate-300 bg-white px-2 py-1 text-xs">Add Freight Quote</button>} />
    <DataTable><thead><tr>{['Quote ID','Date','Origin Zip','Destination Zip','Miles','Weight','Pallet Count','Service Type','Low Estimate','Average Estimate','High Estimate','Cost Per Mile','Cost Per Lb','Actions'].map((h)=><th key={h}>{h}</th>)}</tr></thead><tbody>{quotes.map((q)=>{const fx=calc(q);return <tr key={q.id}><td><Link href={`/freight-quotes/${q.quoteId}`} className="text-cyan-700 font-semibold hover:underline">{q.quoteId}</Link></td><td>{q.date}</td><td>{q.originZip}</td><td>{q.destinationZip}</td><td>{q.miles}</td><td>{q.weight}</td><td>{q.palletCount}</td><td>{q.serviceType}</td><td>${fx.low}</td><td>${fx.avg}</td><td>${fx.high}</td><td>${fx.costPerMile}</td><td>${fx.costPerLb}</td><td><div className="flex gap-1"><button onClick={() => startEdit(q)} className="rounded border border-slate-300 px-2 py-0.5 text-xs">Edit</button><button onClick={() => setConfirmId(q.id)} className="rounded border border-rose-300 px-2 py-0.5 text-xs text-rose-700">Delete</button></div></td></tr>;})}</tbody></DataTable>
    <Modal open={open} title={editing ? `Edit Quote ${editing.quoteId}` : 'Add Freight Quote'} onClose={() => setOpen(false)}>
      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        <input value={draft.quoteId} onChange={(e)=>setDraft({...draft,quoteId:e.target.value})} className="rounded border border-slate-300 px-2 py-1 text-sm" placeholder="Quote ID"/>
        <input value={draft.date} onChange={(e)=>setDraft({...draft,date:e.target.value})} className="rounded border border-slate-300 px-2 py-1 text-sm" placeholder="Date"/>
        <input value={draft.originZip} onChange={(e)=>setDraft({...draft,originZip:e.target.value})} className="rounded border border-slate-300 px-2 py-1 text-sm" placeholder="Origin Zip"/>
        <input value={draft.destinationZip} onChange={(e)=>setDraft({...draft,destinationZip:e.target.value})} className="rounded border border-slate-300 px-2 py-1 text-sm" placeholder="Destination Zip"/>
        <input type="number" value={draft.miles} onChange={(e)=>setDraft({...draft,miles:Number(e.target.value)})} className="rounded border border-slate-300 px-2 py-1 text-sm" placeholder="Miles"/>
        <input type="number" value={draft.weight} onChange={(e)=>setDraft({...draft,weight:Number(e.target.value)})} className="rounded border border-slate-300 px-2 py-1 text-sm" placeholder="Weight"/>
        <input type="number" value={draft.palletCount} onChange={(e)=>setDraft({...draft,palletCount:Number(e.target.value)})} className="rounded border border-slate-300 px-2 py-1 text-sm" placeholder="Pallet Count"/>
        <select value={draft.serviceType} onChange={(e)=>setDraft({...draft,serviceType:e.target.value as ServiceType})} className="rounded border border-slate-300 px-2 py-1 text-sm"><option>Rail</option><option>LTL</option><option>Full Truckload</option></select>
      </div>
      <div className="mt-3 grid gap-2 text-xs md:grid-cols-5"><div className="rounded border border-slate-200 p-2">Low Estimate: <span className="font-semibold">${computed.low}</span></div><div className="rounded border border-slate-200 p-2">Average Estimate: <span className="font-semibold">${computed.avg}</span></div><div className="rounded border border-slate-200 p-2">High Estimate: <span className="font-semibold">${computed.high}</span></div><div className="rounded border border-slate-200 p-2">Cost Per Mile: <span className="font-semibold">${computed.costPerMile}</span></div><div className="rounded border border-slate-200 p-2">Cost Per Lb: <span className="font-semibold">${computed.costPerLb}</span></div></div>
      <div className="mt-4 flex gap-2"><button onClick={save} className="rounded border border-cyan-700 bg-cyan-50 px-3 py-1 text-xs text-cyan-800">Save Estimate</button><button onClick={() => setOpen(false)} className="rounded border border-slate-300 px-3 py-1 text-xs">Cancel</button></div>
    </Modal>
    <ConfirmDialog open={!!confirmId} title="Delete Freight Quote" message="Delete this freight quote from local state?" onCancel={() => setConfirmId(null)} onConfirm={() => { setQuotesStore((prev) => prev.filter((q) => q.id !== confirmId)); setConfirmId(null); }} />
  </div>;
}
