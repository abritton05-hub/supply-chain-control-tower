import { ReactNode } from 'react';
import { SectionHeader } from '@/components/section-header';

export function ModulePageShell({
  title,
  subtitle,
  stats,
  toolbar,
  children,
}: {
  title: string;
  subtitle: string;
  stats?: ReactNode;
  toolbar?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="space-y-4">
      <SectionHeader title={title} subtitle={subtitle} />
      {stats ? <section>{stats}</section> : null}
      {toolbar ? <section>{toolbar}</section> : null}
      <section>{children}</section>
    </div>
  );
}
