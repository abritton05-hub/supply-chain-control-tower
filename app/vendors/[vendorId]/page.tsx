'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { VendorDetailTabs } from '@/components/vendor-detail-tabs';
import { ConfirmDialog, Modal } from '@/components/overlay-ui';
import { useVendorsStore } from '@/lib/state/mock-client-db';
import { Vendor } from '@/lib/types/domain';

const blank: Vendor = { id: 'new', vendorName: '', category: '', contact: '', phone: '', email: '', leadTimeDays: 1, preferred: false, paymentTerms: 'Net 30', orderingMethod: 'PO + Email', creditCardAccepted: true, poRequired: true, notes: '' };

export default function VendorDetailPage({ params }: { params: { vendorId: string } }) {
  const router = useRouter();
  const [vendors, setVendors] = useVendorsStore();
  const vendor = useMemo(() => vendors.find((row) => row.id === params.vendorId), [params.vendorId, vendors]);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Vendor>(vendor ?? blank);
  const [adding, setAdding] = useState(false);
  const [newVendor, setNewVendor] = useState<Vendor>({ ...blank, id: `v-${Date.now()}` });
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (vendor) setDraft(vendor);
  }, [vendor]);

  if (!vendor) return <div className="erp-card p-4 text-sm text-slate-600">Vendor not found.</div>;

  const saveVendor = () => {
    setVendors((prev) => prev.map((row) => row.id === vendor.id ? draft : row));
    setEditing(false);
  };

  const addVendor = () => {
    setVendors((prev) => [...prev, newVendor]);
    setAdding(false);
    router.push(`/vendors/${newVendor.id}`);
  };

  const deleteVendor = () => {
    setVendors((prev) => prev.filter((row) => row.id !== vendor.id));
    setConfirmDelete(false);
    router.push('/vendors');
  };

  return (
    <div className="space-y-3">
      <div className="erp-card p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">{editing ? <input value={draft.vendorName} onChange={(event) => setDraft({ ...draft, vendorName: event.target.value })} className="rounded border border-slate-300 px-2 py-1 text-lg font-semibold" /> : vendor.vendorName}</h2>
            <p className="text-sm text-slate-600">{editing ? <input value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value })} className="mr-2 rounded border border-slate-300 px-2 py-1 text-sm" /> : vendor.category} · {editing ? <input value={draft.email} onChange={(event) => setDraft({ ...draft, email: event.target.value })} className="rounded border border-slate-300 px-2 py-1 text-sm" /> : vendor.email}</p>
          </div>
          <div className="flex gap-2 text-xs">
            <button onClick={() => { setNewVendor({ ...blank, id: `v-${Date.now()}` }); setAdding(true); }} className="rounded border border-slate-300 px-2 py-1">Add</button>
            <button onClick={() => setEditing(true)} className="rounded border border-slate-300 px-2 py-1">Edit</button>
            <button onClick={saveVendor} disabled={!editing} className="rounded border border-cyan-700 bg-cyan-50 px-2 py-1 text-cyan-800 disabled:opacity-40">Save</button>
            <button onClick={() => setConfirmDelete(true)} className="rounded border border-rose-300 px-2 py-1 text-rose-700">Delete</button>
          </div>
        </div>
        <div className="mt-3 grid gap-2 text-xs md:grid-cols-2 xl:grid-cols-3">
          <p><span className="font-semibold">Vendor Name:</span> {editing ? <input value={draft.vendorName} onChange={(event) => setDraft({ ...draft, vendorName: event.target.value })} className="ml-2 rounded border border-slate-300 px-2 py-1" /> : vendor.vendorName}</p>
          <p><span className="font-semibold">Category:</span> {editing ? <input value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value })} className="ml-2 rounded border border-slate-300 px-2 py-1" /> : vendor.category}</p>
          <p><span className="font-semibold">Contact Person:</span> {editing ? <input value={draft.contact} onChange={(event) => setDraft({ ...draft, contact: event.target.value })} className="ml-2 rounded border border-slate-300 px-2 py-1" /> : vendor.contact}</p>
          <p><span className="font-semibold">Email:</span> {editing ? <input value={draft.email} onChange={(event) => setDraft({ ...draft, email: event.target.value })} className="ml-2 rounded border border-slate-300 px-2 py-1" /> : vendor.email}</p>
          <p><span className="font-semibold">Phone:</span> {editing ? <input value={draft.phone} onChange={(event) => setDraft({ ...draft, phone: event.target.value })} className="ml-2 rounded border border-slate-300 px-2 py-1" /> : vendor.phone}</p>
          <p><span className="font-semibold">Lead Time Days:</span> {editing ? <input type="number" value={draft.leadTimeDays} onChange={(event) => setDraft({ ...draft, leadTimeDays: Number(event.target.value) })} className="ml-2 rounded border border-slate-300 px-2 py-1" /> : vendor.leadTimeDays}</p>
          <p><span className="font-semibold">Payment Terms:</span> {editing ? <input value={draft.paymentTerms} onChange={(event) => setDraft({ ...draft, paymentTerms: event.target.value })} className="ml-2 rounded border border-slate-300 px-2 py-1" /> : vendor.paymentTerms}</p>
          <p><span className="font-semibold">Ordering Method:</span> {editing ? <input value={draft.orderingMethod} onChange={(event) => setDraft({ ...draft, orderingMethod: event.target.value })} className="ml-2 rounded border border-slate-300 px-2 py-1" /> : vendor.orderingMethod}</p>
          <p><span className="font-semibold">Credit Card Accepted:</span> {editing ? <select value={draft.creditCardAccepted ? 'YES' : 'NO'} onChange={(event) => setDraft({ ...draft, creditCardAccepted: event.target.value === 'YES' })} className="ml-2 rounded border border-slate-300 px-2 py-1"><option>YES</option><option>NO</option></select> : vendor.creditCardAccepted ? 'YES' : 'NO'}</p>
          <p><span className="font-semibold">PO Required:</span> {editing ? <select value={draft.poRequired ? 'YES' : 'NO'} onChange={(event) => setDraft({ ...draft, poRequired: event.target.value === 'YES' })} className="ml-2 rounded border border-slate-300 px-2 py-1"><option>YES</option><option>NO</option></select> : vendor.poRequired ? 'YES' : 'NO'}</p>
        </div>
      </div>
      <VendorDetailTabs vendor={editing ? draft : vendor} onVendorChange={setDraft} onSaveNotes={saveVendor} />

      <Modal open={adding} title="Add Vendor" onClose={() => setAdding(false)}>
        <div className="grid gap-2 md:grid-cols-2">
          <input value={newVendor.vendorName} onChange={(event) => setNewVendor({ ...newVendor, vendorName: event.target.value })} className="rounded border border-slate-300 px-2 py-1 text-sm" placeholder="Vendor Name" />
          <input value={newVendor.category} onChange={(event) => setNewVendor({ ...newVendor, category: event.target.value })} className="rounded border border-slate-300 px-2 py-1 text-sm" placeholder="Category" />
          <input value={newVendor.contact} onChange={(event) => setNewVendor({ ...newVendor, contact: event.target.value })} className="rounded border border-slate-300 px-2 py-1 text-sm" placeholder="Contact Person" />
          <input value={newVendor.email} onChange={(event) => setNewVendor({ ...newVendor, email: event.target.value })} className="rounded border border-slate-300 px-2 py-1 text-sm" placeholder="Email" />
          <input value={newVendor.phone} onChange={(event) => setNewVendor({ ...newVendor, phone: event.target.value })} className="rounded border border-slate-300 px-2 py-1 text-sm" placeholder="Phone" />
          <input type="number" value={newVendor.leadTimeDays} onChange={(event) => setNewVendor({ ...newVendor, leadTimeDays: Number(event.target.value) })} className="rounded border border-slate-300 px-2 py-1 text-sm" placeholder="Lead Time Days" />
          <input value={newVendor.paymentTerms} onChange={(event) => setNewVendor({ ...newVendor, paymentTerms: event.target.value })} className="rounded border border-slate-300 px-2 py-1 text-sm" placeholder="Payment Terms" />
          <input value={newVendor.orderingMethod} onChange={(event) => setNewVendor({ ...newVendor, orderingMethod: event.target.value })} className="rounded border border-slate-300 px-2 py-1 text-sm" placeholder="Ordering Method" />
        </div>
        <textarea value={newVendor.notes} onChange={(event) => setNewVendor({ ...newVendor, notes: event.target.value })} className="mt-2 h-24 w-full rounded border border-slate-300 px-2 py-1 text-sm" placeholder="Notes" />
        <div className="mt-4 flex gap-2"><button onClick={addVendor} className="rounded border border-cyan-700 bg-cyan-50 px-3 py-1 text-xs text-cyan-800">Add Vendor</button><button onClick={() => setAdding(false)} className="rounded border border-slate-300 px-3 py-1 text-xs">Cancel</button></div>
      </Modal>

      <ConfirmDialog open={confirmDelete} title="Delete Vendor" message={`Delete ${vendor.vendorName} from local mock state?`} onCancel={() => setConfirmDelete(false)} onConfirm={deleteVendor} />
    </div>
  );
}
