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
};

export function StatusChip({ value }: { value: string }) {
  const normalized = value.replace(' ', '_');
  const classes = map[normalized] ?? map[value] ?? 'bg-slate-100 text-slate-700';
  return <span className={`rounded px-2 py-1 text-xs font-semibold ${classes}`}>{value}</span>;
}
