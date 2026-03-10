import { SectionHeader } from '@/components/section-header';

const locations = [
  { name: 'Main WH', type: 'Warehouse' },
  { name: 'Line 2', type: 'Production' },
  { name: 'QA', type: 'Inspection' },
  { name: 'Shipping', type: 'Outbound' },
];

export default function LocationsPage() {
  return <div><SectionHeader title="Locations" subtitle="Master location registry for inventory movement" /><div className="erp-card p-4"><ul className="space-y-2 text-sm">{locations.map((l) => <li key={l.name} className="flex justify-between border-b border-slate-100 pb-2"><span>{l.name}</span><span className="text-slate-500">{l.type}</span></li>)}</ul></div></div>;
}
