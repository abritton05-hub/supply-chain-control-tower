'use client';

import Link from 'next/link';
import { useState } from 'react';
import { DataTable } from '@/components/data-table';
import { SectionHeader } from '@/components/section-header';
import { StatusChip } from '@/components/status-chip';
import { ConfirmDialog, Modal } from '@/components/overlay-ui';
import { shipmentLog as seed } from '@/lib/data/mock-data';
import { shipmentDelayFlag } from '@/lib/logic';
import { ShipmentLog } from '@/lib/types/domain';

const blank: ShipmentLog = { id: 'new', shipDate: '', project: '', poNumber: '', customer: '', itemId: 'INV-1001', serialNumber: '-', carrier: '', trackingNumber: '', waybill: '', estimatedDelivery: '', status: 'IN_TRANSIT' };

export default function ShipmentLogPage() {
  const [rows, setRows] = useState<ShipmentLog[]>(seed);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ShipmentLog | null>(null);
  const [draft, setDraft] = useState<ShipmentLog>(blank);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const startAdd = () => { setEditing(null); setDraft({ ...blank, id: `sh-${Date.now()}` }); setOpen(true); };
  const startEdit = (s: ShipmentLog) => { setEditing(s); setDraft(s); setOpen(true); };
  const save = () => { if (editing) setRows((prev) => prev.map((r) => (r.id === editing.id ? draft : r))); else setRows((prev) => [...prev, draft]); setOpen(false); };

  return <div><SectionHeader title="Shipment Log" subtitle="Outbound shipping visibility with delay flag" actions={<button onClick={startAdd} className="rounded border border-slate-300 bg-white px-2 py-1 text-xs">Add Shipment</button>} /><DataTable><thead><tr>{['Shipment ID','Ship Date','Project','PO Number','Customer','Item ID','Serial Number','Carrier','Tracking Number','Waybill','Estimated Delivery','Actual Delivery','Status','Delay Flag','Actions'].map((h)=><th key={h}>{h}</th>)}</tr></thead><tbody>{rows.map((s)=><tr key={s.id}><td><Link href={`/shipment-log/${s.id}`} className="text-cyan-700 font-semibold hover:underline">{s.id}</Link></td><td>{s.shipDate}</td><td>{s.project}</td><td>{s.poNumber}</td><td>{s.customer}</td><td>{s.itemId}</td><td>{s.serialNumber}</td><td>{s.carrier}</td><td>{s.trackingNumber}</td><td>{s.waybill}</td><td>{s.estimatedDelivery}</td><td>{s.actualDelivery ?? '-'}</td><td><StatusChip value={s.status} /></td><td>{shipmentDelayFlag(s)}</td><td><div className="flex gap-1"><button onClick={() => startEdit(s)} className="rounded border border-slate-300 px-2 py-0.5 text-xs">Edit</button><button onClick={() => setConfirmId(s.id)} className="rounded border border-rose-300 px-2 py-0.5 text-xs text-rose-700">Delete</button></div></td></tr>)}</tbody></DataTable>
    <Modal open={open} title={editing ? `Edit Shipment ${editing.id}` : 'Add Shipment'} onClose={() => setOpen(false)}>
      <div className="grid gap-2 md:grid-cols-2">
        <input value={draft.id} onChange={(e)=>setDraft({...draft,id:e.target.value})} className="rounded border border-slate-300 px-2 py-1 text-sm" placeholder="Shipment ID" />
        <input value={draft.shipDate} onChange={(e)=>setDraft({...draft,shipDate:e.target.value})} className="rounded border border-slate-300 px-2 py-1 text-sm" placeholder="Ship Date" />
        <input value={draft.customer} onChange={(e)=>setDraft({...draft,customer:e.target.value})} className="rounded border border-slate-300 px-2 py-1 text-sm" placeholder="Customer" />
        <input value={draft.carrier} onChange={(e)=>setDraft({...draft,carrier:e.target.value})} className="rounded border border-slate-300 px-2 py-1 text-sm" placeholder="Carrier" />
        <input value={draft.trackingNumber} onChange={(e)=>setDraft({...draft,trackingNumber:e.target.value})} className="rounded border border-slate-300 px-2 py-1 text-sm" placeholder="Tracking Number" />
        <input value={draft.waybill} onChange={(e)=>setDraft({...draft,waybill:e.target.value})} className="rounded border border-slate-300 px-2 py-1 text-sm" placeholder="Waybill" />
        <input value={draft.estimatedDelivery} onChange={(e)=>setDraft({...draft,estimatedDelivery:e.target.value})} className="rounded border border-slate-300 px-2 py-1 text-sm" placeholder="Estimated Delivery" />
        <input value={draft.actualDelivery ?? ''} onChange={(e)=>setDraft({...draft,actualDelivery:e.target.value})} className="rounded border border-slate-300 px-2 py-1 text-sm" placeholder="Actual Delivery" />
        <select value={draft.status} onChange={(e)=>setDraft({...draft,status:e.target.value as ShipmentLog['status']})} className="rounded border border-slate-300 px-2 py-1 text-sm"><option>IN_TRANSIT</option><option>DELIVERED</option><option>DELAYED</option></select>
      </div>
      <div className="mt-4 flex gap-2"><button onClick={save} className="rounded border border-cyan-700 bg-cyan-50 px-3 py-1 text-xs text-cyan-800">Save</button><button onClick={() => setOpen(false)} className="rounded border border-slate-300 px-3 py-1 text-xs">Cancel</button></div>
    </Modal>
    <ConfirmDialog open={!!confirmId} title="Delete Shipment" message="Delete this shipment from local state?" onCancel={() => setConfirmId(null)} onConfirm={() => { setRows((prev) => prev.filter((s) => s.id !== confirmId)); setConfirmId(null); }} />
  </div>;
}
