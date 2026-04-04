import Link from 'next/link';
import { DataTable } from '@/components/data-table';
import { SectionHeader } from '@/components/section-header';
import { projectBuilds } from '@/lib/data/mock-data';

export default function ProjectsPage() {
  return <div><SectionHeader title="Projects / Builds" subtitle="Material allocation against active work" actions={<button className="rounded border border-slate-300 bg-white px-2 py-1 text-xs">Add Project</button>} /><DataTable><thead><tr>{['Project ID','Customer','PO Number','Work Order','Item ID','Required Qty','Issued Qty','Build Status','Ship Status'].map((h)=><th key={h}>{h}</th>)}</tr></thead><tbody>{projectBuilds.map((p)=><tr key={p.projectId}><td><Link href={`/projects/${p.projectId}`} className="text-cyan-700 font-semibold hover:underline">{p.projectId}</Link></td><td>{p.customer}</td><td><Link href={`/open-pos/${p.poNumber}`} className="text-cyan-700 hover:underline">{p.poNumber}</Link></td><td>{p.workOrder}</td><td><Link href={`/inventory/${p.itemId}`} className="text-cyan-700 hover:underline">{p.itemId}</Link></td><td>{p.requiredQty}</td><td>{p.issuedQty}</td><td>{p.buildStatus}</td><td>{p.shipStatus}</td></tr>)}</tbody></DataTable></div>;
}
