import { SectionHeader } from '@/components/section-header';

const departments = ['Assembly', 'Warehouse', 'Service', 'Engineering'];

export default function DepartmentsPage() {
  return <div><SectionHeader title="Departments" subtitle="Master department list for ownership and planning" /><div className="erp-card p-4"><ul className="grid gap-2 text-sm md:grid-cols-2">{departments.map((d) => <li key={d} className="rounded border border-slate-200 bg-slate-50 px-3 py-2">{d}</li>)}</ul></div></div>;
}
