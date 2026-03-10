import { notFound } from 'next/navigation';
<<<<<<< HEAD
import { projectBuilds, serialRecords } from '@/lib/data/mock-data';
=======
import { projectBuilds } from '@/lib/data/mock-data';
>>>>>>> origin/main

export default function ProjectDetailPage({ params }: { params: { projectId: string } }) {
  const project = projectBuilds.find((row) => row.projectId === params.projectId);
  if (!project) return notFound();
<<<<<<< HEAD
  const linked = serialRecords.filter((s) => s.project === project.projectId);
  return <div className="space-y-3"><div className="erp-card p-4"><h2 className="text-lg font-semibold">{project.projectId}</h2><p className="text-sm text-slate-600">{project.customer} · {project.workOrder}</p><div className="mt-2 flex gap-2 text-xs"><button className="rounded border border-slate-300 px-2 py-1">Edit Project</button><button className="rounded border border-slate-300 px-2 py-1">Archive Project</button><button className="rounded border border-slate-300 px-2 py-1">Delete Project</button></div></div><div className="erp-card p-4"><h3 className="text-sm font-semibold">Linked Serials</h3><p className="mt-2 text-sm text-slate-600">{linked.map((s) => `${s.serialNumber} (${s.status})`).join(', ') || 'None linked.'}</p></div></div>;
=======
  return <div className="erp-card p-4"><h2 className="text-lg font-semibold">{project.projectId}</h2><p className="text-sm text-slate-600">{project.customer} · {project.workOrder}</p></div>;
>>>>>>> origin/main
}
