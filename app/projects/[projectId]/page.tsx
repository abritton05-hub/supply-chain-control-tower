import { notFound } from 'next/navigation';
import { projectBuilds } from '@/lib/data/mock-data';

export default function ProjectDetailPage({ params }: { params: { projectId: string } }) {
  const project = projectBuilds.find((row) => row.projectId === params.projectId);
  if (!project) return notFound();
  return <div className="erp-card p-4"><h2 className="text-lg font-semibold">{project.projectId}</h2><p className="text-sm text-slate-600">{project.customer} · {project.workOrder}</p></div>;
}
