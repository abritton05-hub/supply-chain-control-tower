export function KpiCard({ label, value, helper }: { label: string; value: string | number; helper?: string }) {
  return (
    <article className="erp-card p-4">
      <p className="mb-3 border-b border-slate-200 pb-2 text-base font-semibold text-slate-900">{label}</p>
      <p className="text-2xl font-semibold text-slate-900">{value}</p>
      {helper ? <p className="mt-1 text-xs text-slate-500">{helper}</p> : null}
    </article>
  );
}
