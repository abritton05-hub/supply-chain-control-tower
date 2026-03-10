import { ReactNode } from 'react';

export function FilterBar({ children }: { children: ReactNode }) {
  return <div className="erp-card mb-4 grid gap-3 p-3 md:grid-cols-2 lg:grid-cols-5">{children}</div>;
}
