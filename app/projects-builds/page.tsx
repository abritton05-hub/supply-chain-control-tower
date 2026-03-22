'use client';

import Link from 'next/link';
import { useState } from 'react';
import { DataTable } from '@/components/data-table';
import { SectionHeader } from '@/components/section-header';
import { ConfirmDialog, Modal } from '@/components/overlay-ui';
import { useProjectsStore } from '@/lib/state/mock-client-db';
import { ProjectBuild } from '@/lib/types/domain';

const blank: ProjectBuild = { id: 'new', projectId: '', customer: '', poNumber: '', workOrder: '', itemId: 'INV-1001', requiredQty: 0, issuedQty: 0, buildStatus: 'NOT_STARTED', shipStatus: 'NOT_READY' };

export default function ProjectsBuildsPage() {
  const [projects, setProjects] = useProjectsStore();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ProjectBuild | null>(null);
  const [draft, setDraft] = useState<ProjectBuild>(blank);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const startAdd = () => { setEditing(null); setDraft({ ...blank, id: `p-${Date.now()}` }); setOpen(true); };
  const startEdit = (p: ProjectBuild) => { setEditing(p); setDraft(p); setOpen(true); };
  const save = () => { if (editing) setProjects((prev) => prev.map((p) => (p.id === editing.id ? draft : p))); else setProjects((prev) => [...prev, draft]); setOpen(false); };

  return <div><SectionHeader title="Projects / Builds" subtitle="Material allocation against active work" actions={<button onClick={startAdd} className="rounded border border-slate-300 bg-white px-2 py-1 text-xs">Add Project</button>} /><DataTable><thead><tr>{['Project ID','Customer','PO Number','Work Order','Item ID','Required Qty','Issued Qty','Build Status','Ship Status','Actions'].map((h)=><th key={h}>{h}</th>)}</tr></thead><tbody>{projects.map((p)=><tr key={p.id}><td><Link href={`/projects-builds/${p.projectId}`} className="text-cyan-700 font-semibold hover:underline">{p.projectId}</Link></td><td>{p.customer}</td><td>{p.poNumber}</td><td>{p.workOrder}</td><td>{p.itemId}</td><td>{p.requiredQty}</td><td>{p.issuedQty}</td><td>{p.buildStatus}</td><td>{p.shipStatus}</td><td><div className="flex gap-1"><button onClick={() => startEdit(p)} className="rounded border border-slate-300 px-2 py-0.5 text-xs">Edit</button><button onClick={() => setConfirmId(p.id)} className="rounded border border-rose-300 px-2 py-0.5 text-xs text-rose-700">Delete</button></div></td></tr>)}</tbody></DataTable>
  <Modal open={open} title={editing ? `Edit Project ${editing.projectId}` : 'Add Project'} onClose={() => setOpen(false)}>
    <div className="grid gap-2 md:grid-cols-2">
      <input value={draft.projectId} onChange={(e)=>setDraft({...draft,projectId:e.target.value})} className="rounded border border-slate-300 px-2 py-1 text-sm" placeholder="Project ID" />
      <input value={draft.customer} onChange={(e)=>setDraft({...draft,customer:e.target.value})} className="rounded border border-slate-300 px-2 py-1 text-sm" placeholder="Customer" />
      <input value={draft.poNumber} onChange={(e)=>setDraft({...draft,poNumber:e.target.value})} className="rounded border border-slate-300 px-2 py-1 text-sm" placeholder="PO Number" />
      <input value={draft.workOrder} onChange={(e)=>setDraft({...draft,workOrder:e.target.value})} className="rounded border border-slate-300 px-2 py-1 text-sm" placeholder="Work Order" />
      <select value={draft.buildStatus} onChange={(e)=>setDraft({...draft,buildStatus:e.target.value as ProjectBuild['buildStatus']})} className="rounded border border-slate-300 px-2 py-1 text-sm"><option>NOT_STARTED</option><option>IN_PROGRESS</option><option>COMPLETE</option></select>
      <select value={draft.shipStatus} onChange={(e)=>setDraft({...draft,shipStatus:e.target.value as ProjectBuild['shipStatus']})} className="rounded border border-slate-300 px-2 py-1 text-sm"><option>NOT_READY</option><option>PARTIAL</option><option>SHIPPED</option></select>
    </div>
    <div className="mt-4 flex gap-2"><button onClick={save} className="rounded border border-cyan-700 bg-cyan-50 px-3 py-1 text-xs text-cyan-800">Save</button><button onClick={() => setOpen(false)} className="rounded border border-slate-300 px-3 py-1 text-xs">Cancel</button></div>
  </Modal>
  <ConfirmDialog open={!!confirmId} title="Delete Project" message="Delete this project record from local state?" onCancel={() => setConfirmId(null)} onConfirm={() => { setProjects((prev) => prev.filter((p) => p.id !== confirmId)); setConfirmId(null); }} />
  </div>;
}
