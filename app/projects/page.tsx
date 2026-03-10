import { DataTable } from '@/components/data-table';
import { SectionHeader } from '@/components/section-header';
import { projectBuilds } from '@/lib/data/mock-data';

export default function ProjectsPage() {
  return <div><SectionHeader title="Projects / Builds" subtitle="Material allocation against active work" /><DataTable><thead><tr>{['Project ID','Customer','PO Number','Work Order','Item ID','Required Qty','Issued Qty','Build Status','Ship Status'].map((h)=><th key={h}>{h}</th>)}</tr></thead><tbody>{projectBuilds.map((p)=><tr key={p.projectId}><td>{p.projectId}</td><td>{p.customer}</td><td>{p.poNumber}</td><td>{p.workOrder}</td><td>{p.itemId}</td><td>{p.requiredQty}</td><td>{p.issuedQty}</td><td>{p.buildStatus}</td><td>{p.shipStatus}</td></tr>)}</tbody></DataTable></div>;
}
