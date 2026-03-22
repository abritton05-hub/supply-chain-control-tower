'use client';

import { SectionHeader } from '@/components/section-header';
import { useLocationsStore } from '@/lib/state/mock-client-db';

export default function LocationsPage() { const [locations] = useLocationsStore(); return <div><SectionHeader title="Locations" subtitle="Master location registry for inventory movement" /><div className="erp-card p-4"><ul className="space-y-2 text-sm">{locations.map((l) => <li key={l.name} className="flex justify-between border-b border-slate-100 pb-2"><span>{l.name}</span><span className="text-slate-500">{l.type}</span></li>)}</ul></div></div>; }
