import { ReactNode } from 'react';

export function DataTable({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-300 bg-white shadow-sm">
      <div className="w-full overflow-x-auto">
        <table className="erp-table w-full min-w-[1100px]">{children}</table>
      </div>
    </div>
  );
}