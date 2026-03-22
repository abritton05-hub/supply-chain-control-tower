'use client';

import Link from 'next/link';
import { useState } from 'react';
import { DataTable } from '@/components/data-table';
import { SectionHeader } from '@/components/section-header';
import { ConfirmDialog, SlideOver } from '@/components/overlay-ui';
import { useVendorsStore } from '@/lib/state/mock-client-db';
import { Vendor } from '@/lib/types/domain';

const blank: Vendor = { id: 'new', vendorName: '', category: '', contact: '', phone: '', email: '', leadTimeDays: 1, preferred: false, paymentTerms: 'Net 30', orderingMethod: 'PO + Email', creditCardAccepted: true, poRequired: true, notes: '' };

export default function VendorsPage() {
  const [vendors, setVendors] = useVendorsStore();
  const [selected, setSelected] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Vendor | null>(null);
  const [draft, setDraft] = useState<Vendor>(blank);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const startAdd = () => { setEditing(null); setDraft({ ...blank, id: `v-${Date.now()}` }); setOpen(true); };
  const startEdit = (vendor: Vendor) => { setEditing(vendor); setDraft(vendor); setOpen(true); };
  const save = () => {
    if (editing) setVendors((prev) => prev.map((vendor) => (vendor.id === editing.id ? draft : vendor)));
    else setVendors((prev) => [...prev, draft]);
    setOpen(false);
  };
  const toggleSelected = (vendorId: string) => setSelected((prev) => prev.includes(vendorId) ? prev.filter((id) => id !== vendorId) : [...prev, vendorId]);

  return <div><SectionHeader title="Vendors" subtitle="Supplier registry prepared for future bulk entry workflows" actions={<div className='flex gap-2 text-xs'><button onClick={startAdd} className='rounded border border-slate-300 px-2 py-1'>Add Vendor</button><span className='rounded border border-slate-200 bg-slate-50 px-2 py-1 text-slate-500'>Selected: {selected.length}</span></div>} /><DataTable><thead><tr>{['Select','Vendor Name','Category','Contact','Phone','Email','Lead Time Days','Preferred','Notes','Actions'].map((h)=><th key={h}>{h}</th>)}</tr></thead><tbody>{vendors.map((vendor)=><tr key={vendor.id} className="hover:bg-cyan-50/50"><td><input type="checkbox" checked={selected.includes(vendor.id)} onChange={() => toggleSelected(vendor.id)} /></td><td><Link href={`/vendors/${vendor.id}`} className="text-cyan-700 font-semibold hover:underline">{vendor.vendorName}</Link></td><td>{vendor.category}</td><td>{vendor.contact}</td><td>{vendor.phone}</td><td>{vendor.email}</td><td>{vendor.leadTimeDays}</td><td>{vendor.preferred ? 'YES' : 'NO'}</td><td className="max-w-56 truncate">{vendor.notes}</td><td><div className="flex gap-1"><button onClick={() => startEdit(vendor)} className="rounded border border-slate-300 px-2 py-0.5 text-xs">Edit</button><button onClick={() => setConfirmId(vendor.id)} className="rounded border border-rose-300 px-2 py-0.5 text-xs text-rose-700">Delete</button></div></td></tr>)}</tbody></DataTable>
    <SlideOver open={open} title={editing ? `Edit Vendor ${editing.vendorName}` : 'Add Vendor'} onClose={() => setOpen(false)}>
      <div className="grid gap-2 md:grid-cols-2">
        <input value={draft.vendorName} onChange={(e) => setDraft({ ...draft, vendorName: e.target.value })} className="rounded border border-slate-300 px-2 py-1 text-sm" placeholder="Vendor Name" />
        <input value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })} className="rounded border border-slate-300 px-2 py-1 text-sm" placeholder="Category" />
        <input value={draft.contact} onChange={(e) => setDraft({ ...draft, contact: e.target.value })} className="rounded border border-slate-300 px-2 py-1 text-sm" placeholder="Contact Person" />
        <input value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} className="rounded border border-slate-300 px-2 py-1 text-sm" placeholder="Email" />
        <input value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} className="rounded border border-slate-300 px-2 py-1 text-sm" placeholder="Phone" />
        <input type="number" value={draft.leadTimeDays} onChange={(e) => setDraft({ ...draft, leadTimeDays: Number(e.target.value) })} className="rounded border border-slate-300 px-2 py-1 text-sm" placeholder="Lead Time Days" />
        <input value={draft.paymentTerms} onChange={(e) => setDraft({ ...draft, paymentTerms: e.target.value })} className="rounded border border-slate-300 px-2 py-1 text-sm" placeholder="Payment Terms" />
        <input value={draft.orderingMethod} onChange={(e) => setDraft({ ...draft, orderingMethod: e.target.value })} className="rounded border border-slate-300 px-2 py-1 text-sm" placeholder="Ordering Method" />
        <select value={draft.creditCardAccepted ? 'YES' : 'NO'} onChange={(e) => setDraft({ ...draft, creditCardAccepted: e.target.value === 'YES' })} className="rounded border border-slate-300 px-2 py-1 text-sm"><option>YES</option><option>NO</option></select>
        <select value={draft.poRequired ? 'YES' : 'NO'} onChange={(e) => setDraft({ ...draft, poRequired: e.target.value === 'YES' })} className="rounded border border-slate-300 px-2 py-1 text-sm"><option>YES</option><option>NO</option></select>
      </div>
      <textarea value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} className="mt-2 h-24 w-full rounded border border-slate-300 px-2 py-1 text-sm" placeholder="Notes" />
      <div className="mt-4 flex gap-2"><button onClick={save} className="rounded border border-cyan-700 bg-cyan-50 px-3 py-1 text-xs text-cyan-800">Save</button><button onClick={() => setOpen(false)} className="rounded border border-slate-300 px-3 py-1 text-xs">Cancel</button></div>
    </SlideOver>
    <ConfirmDialog open={!!confirmId} title="Delete Vendor" message="Delete this vendor from local state?" onCancel={() => setConfirmId(null)} onConfirm={() => { setVendors((prev) => prev.filter((vendor) => vendor.id !== confirmId)); setConfirmId(null); }} />
  </div>;
}
