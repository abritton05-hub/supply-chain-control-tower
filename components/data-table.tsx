import { ReactNode } from 'react';

export function DataTable({ children }: { children: ReactNode }) {
  return (
    <div className="erp-card overflow-auto">
      <table className="erp-table min-w-full">{children}</table>
    </div>
  );
}
