const map: Record<string, string> = {
  CRITICAL: 'bg-rose-100 text-rose-700',
  HIGH: 'bg-orange-100 text-orange-700',
  NORMAL: 'bg-amber-100 text-amber-700',
  LOW: 'bg-emerald-100 text-emerald-700',
  YES: 'bg-rose-100 text-rose-700',
  OK: 'bg-emerald-100 text-emerald-700',
  DELAYED: 'bg-rose-100 text-rose-700',
  IN_TRANSIT: 'bg-sky-100 text-sky-700',
  SHIPPED: 'bg-emerald-100 text-emerald-700',
  ORDER_NOW: 'bg-rose-100 text-rose-700',
  RISK: 'bg-orange-100 text-orange-700',
  REVIEW: 'bg-amber-100 text-amber-700',
  PENDING: 'bg-slate-100 text-slate-700',
<<<<<<< HEAD
  RECEIPT: 'bg-emerald-100 text-emerald-700',
  ISSUE: 'bg-orange-100 text-orange-700',
  TRANSFER: 'bg-sky-100 text-sky-700',
  ADJUSTMENT: 'bg-amber-100 text-amber-700',
  CYCLE_COUNT: 'bg-slate-100 text-slate-700',
  BUILD_ISSUE: 'bg-indigo-100 text-indigo-700',
  BUILD_COMPLETE: 'bg-emerald-100 text-emerald-700',
  SHIP: 'bg-cyan-100 text-cyan-700',
  RETURN: 'bg-purple-100 text-purple-700',
  SCRAP: 'bg-rose-100 text-rose-700',
  LOCATION_MOVE: 'bg-slate-100 text-slate-700',
  Received: 'bg-slate-100 text-slate-700',
  'In Stock': 'bg-emerald-100 text-emerald-700',
  Allocated: 'bg-amber-100 text-amber-700',
  'In Build': 'bg-sky-100 text-sky-700',
  Staged: 'bg-indigo-100 text-indigo-700',
  Delivered: 'bg-emerald-100 text-emerald-700',
  Returned: 'bg-orange-100 text-orange-700',
  Scrapped: 'bg-rose-100 text-rose-700',
=======
>>>>>>> origin/main
};

export function StatusChip({ value }: { value: string }) {
  const normalized = value.replace(' ', '_');
  const classes = map[normalized] ?? map[value] ?? 'bg-slate-100 text-slate-700';
  return <span className={`rounded px-2 py-1 text-xs font-semibold ${classes}`}>{value}</span>;
}
