export function KpiCard({ label, value, helper }: { label: string; value: string | number; helper?: string }) {
  return (
    <article className="erp-card p-4">
<<<<<<< HEAD
      <p className="mb-3 border-b border-slate-200 pb-2 text-base font-semibold text-slate-900">{label}</p>
      <p className="text-2xl font-semibold text-slate-900">{value}</p>
=======
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-900">{value}</p>
>>>>>>> origin/main
      {helper ? <p className="mt-1 text-xs text-slate-500">{helper}</p> : null}
    </article>
  );
}
