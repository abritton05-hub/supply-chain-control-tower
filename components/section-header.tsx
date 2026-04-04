type Props = {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
};

export function SectionHeader({ title, subtitle, actions }: Props) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
        {subtitle && (
          <p className="text-sm text-slate-500">{subtitle}</p>
        )}
      </div>

      {actions && <div>{actions}</div>}
    </div>
  );
}