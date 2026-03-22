export function KpiCard({ label, value, helper, onClick }: { label: string; value: string | number; helper?: string; onClick?: () => void }) {
  const classes = onClick
    ? 'erp-card w-full p-4 text-left transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-slate-400'
    : 'erp-card p-4';

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={classes}>
        <p className="mb-3 border-b border-slate-200 pb-2 text-base font-semibold text-slate-900">{label}</p>
        <p className="text-2xl font-semibold text-slate-900">{value}</p>
        {helper ? <p className="mt-1 text-xs text-slate-500">{helper}</p> : null}
      </button>
    );
  }

  return (
    <article className={classes}>
      <p className="mb-3 border-b border-slate-200 pb-2 text-base font-semibold text-slate-900">{label}</p>
      <p className="text-2xl font-semibold text-slate-900">{value}</p>
      {helper ? <p className="mt-1 text-xs text-slate-500">{helper}</p> : null}
    </article>
  );
}
