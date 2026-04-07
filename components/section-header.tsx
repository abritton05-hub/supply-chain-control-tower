type Props = {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
};

export function SectionHeader({ title, subtitle, actions }: Props) {
  return (
    <div className="rounded-2xl border border-slate-300 bg-white px-6 py-5 shadow-sm">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">{title}</h1>
          {subtitle ? (
            <p className="mt-2 text-base text-slate-600">{subtitle}</p>
          ) : null}
        </div>

        {actions ? <div className="shrink-0">{actions}</div> : null}
      </div>
    </div>
  );
}