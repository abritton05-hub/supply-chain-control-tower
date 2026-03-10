import { ReactNode } from 'react';

export function TableToolbar({ children }: { children: ReactNode }) {
  return <div className="erp-card grid gap-3 p-3 md:grid-cols-2 xl:grid-cols-5">{children}</div>;
}
