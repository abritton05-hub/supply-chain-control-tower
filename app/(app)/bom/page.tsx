import Link from 'next/link';
import { DataTable } from '@/components/data-table';
import { ModulePageShell } from '@/components/module-page-shell';
import { supabaseRest } from '@/lib/supabase/rest';

type BomHeader = {
  id: string;
  bom_number: string | null;
  bom_date: string | null;
  project_job_number: string | null;
  requested_by: string | null;
};

function formatDate(value: string | null) {
  if (!value) return '-';
  return new Date(`${value}T00:00:00`).toLocaleDateString();
}

export default async function BomListPage() {
  const boms = await supabaseRest<BomHeader[]>('boms', {
    params: {
      select: 'id,bom_number,bom_date,project_job_number,requested_by',
      order: 'bom_date.desc.nullslast',
      limit: 200,
    },
  });

  return (
    <ModulePageShell
      title="Bill of Materials"
      subtitle="Recent BOMs ready for review, print, and shipment preparation"
      toolbar={
        <div className="flex justify-end">
          <Link href="/bom/new" className="rounded bg-cyan-700 px-3 py-2 text-sm font-semibold text-white hover:bg-cyan-800">
            Create BOM
          </Link>
        </div>
      }
    >
      {boms.length === 0 ? (
        <section className="erp-card p-8 text-center">
          <h2 className="text-base font-semibold text-slate-800">No BOMs yet</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-slate-500">
            Start by creating your first bill of materials. Once saved, BOMs will appear here with quick links to view and print.
          </p>
          <div className="mt-5">
            <Link href="/bom/new" className="rounded bg-cyan-700 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-800">
              Create your first BOM
            </Link>
          </div>
        </section>
      ) : (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Saved BOMs</p>
          <DataTable>
          <thead>
            <tr>
              <th>BOM #</th>
              <th>Date</th>
              <th>Project / Job #</th>
              <th>Requested By</th>
            </tr>
          </thead>
          <tbody>
            {boms.map((bom) => (
              <tr key={bom.id}>
                <td>
                  <Link href={`/bom/${bom.id}`} className="font-semibold text-cyan-700 hover:underline">
                    {bom.bom_number || '(Auto-numbered)'}
                  </Link>
                </td>
                <td>{formatDate(bom.bom_date)}</td>
                <td>{bom.project_job_number || '-'}</td>
                <td>{bom.requested_by || '-'}</td>
              </tr>
            ))}
          </tbody>
          </DataTable>
        </div>
      )}
    </ModulePageShell>
  );
}
