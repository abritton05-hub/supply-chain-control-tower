import { ReactNode } from 'react';

export function StatStrip({ children }: { children: ReactNode }) {
  return <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">{children}</div>;
}
