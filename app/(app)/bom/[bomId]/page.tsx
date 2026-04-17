import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PrintBomButton } from '@/components/bom/print-bom-button';
import { supabaseRest } from '@/lib/supabase/rest';

type BomHeader = {
  id: string;
  bom_number: string | null;
  date: string | null;
  project_job: string | null;
  ship_from: string | null;
  ship_to: string | null;
  po_number: string | null;
  reference_number: string | null;
  requested_by: string | null;
  notes: string | null;
  authorized_by: string | null;
  authorized_date: string | null;
};

type BomLine = {
  id: string;
  line_number: number | null;
  item: string | null;
  part_number: string | null;
  description: string | null;
  qty: number | null;
  unit: string | null;
};

function displayDate(value: string | null) {
  if (!value) return '-';
  return new Date(`${value}T00:00:00`).toLocaleDateString();
}

export default async function BomDetailPage({ params }: { params: { bomId: string } }) {
  const [bom] = await supabaseRest<BomHeader[]>('boms', {
    params: {
      select: 'id,bom_number,date,project_job,ship_from,ship_to,po_number,reference_number,requested_by,notes,authorized_by,authorized_date',
      id: `eq.${params.bomId}`,
      limit: 1,
    },
  });

  if (!bom) notFound();

  const lines = await supabaseRest<BomLine[]>('bom_lines', {
    params: {
      select: 'id,line_number,item,part_number,description,qty,unit',
      bom_id: `eq.${params.bomId}`,
      order: 'line_number.asc.nullslast',
    },
  });

  const paddedLines = [...lines];
  while (paddedLines.length < 10) {
    paddedLines.push({
      id: `blank-${paddedLines.length}`,
      line_number: null,
      item: '',
      part_number: '',
      description: '',
      qty: null,
      unit: '',
    });
  }

  return (
    <div className="mx-auto max-w-5xl space-y-3 print:max-w-none print:space-y-0">
      <div className="flex items-center justify-between print:hidden">
        <div className="flex gap-2">
          <Link href="/bom" className="rounded border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
            Back to BOMs
          </Link>
          <Link href="/bom/new" className="rounded border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
            Create BOM
          </Link>
        </div>
        <PrintBomButton />
      </div>

      <article className="erp-card bg-white p-5 text-[13px] text-slate-900 print:rounded-none print:border-slate-400 print:p-4 print:shadow-none">
        <header className="mb-3 border-b border-slate-300 pb-2">
          <h1 className="text-base font-bold tracking-[0.08em]">BILL OF MATERIALS</h1>
        </header>

        <section className="mb-3 grid grid-cols-3 gap-2 rounded border border-slate-300 bg-slate-50 p-2 text-xs">
          <div>
            <p className="font-semibold uppercase tracking-wide text-slate-500">BOM #</p>
            <p className="text-sm font-bold text-slate-900">{bom.bom_number || '-'}</p>
          </div>
          <div>
            <p className="font-semibold uppercase tracking-wide text-slate-500">Date</p>
            <p className="text-sm font-semibold text-slate-900">{displayDate(bom.date)}</p>
          </div>
          <div>
            <p className="font-semibold uppercase tracking-wide text-slate-500">Project / Job #</p>
            <p className="text-sm font-semibold text-slate-900">{bom.project_job || '-'}</p>
          </div>
        </section>

        <section className="grid grid-cols-2 gap-3 border-b border-slate-300 pb-3">
          <table className="w-full border border-slate-300 text-xs">
            <tbody>
              <tr>
                <td className="w-[40%] border border-slate-300 bg-slate-50 px-2 py-1 font-semibold">PO #</td>
                <td className="border border-slate-300 px-2 py-1">{bom.po_number || '-'}</td>
              </tr>
              <tr>
                <td className="border border-slate-300 bg-slate-50 px-2 py-1 font-semibold">Reference #</td>
                <td className="border border-slate-300 px-2 py-1">{bom.reference_number || '-'}</td>
              </tr>
              <tr>
                <td className="border border-slate-300 bg-slate-50 px-2 py-1 font-semibold">Requested By</td>
                <td className="border border-slate-300 px-2 py-1">{bom.requested_by || '-'}</td>
              </tr>
              <tr>
                <td className="border border-slate-300 bg-slate-50 px-2 py-1 font-semibold">Document ID</td>
                <td className="border border-slate-300 px-2 py-1">{bom.id}</td>
              </tr>
            </tbody>
          </table>

          <div className="space-y-2 text-xs">
            <div>
              <p className="mb-1 font-semibold uppercase tracking-wide">Ship From</p>
              <p className="min-h-20 whitespace-pre-line border border-slate-300 p-2">{bom.ship_from || '-'}</p>
            </div>
            <div>
              <p className="mb-1 font-semibold uppercase tracking-wide">Ship To</p>
              <p className="min-h-20 whitespace-pre-line border border-slate-300 p-2">{bom.ship_to || '-'}</p>
            </div>
          </div>
        </section>

        <section className="mt-3">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-700">Materials</p>
          <table className="min-w-full table-fixed border border-slate-300 text-xs">
            <thead>
              <tr className="bg-slate-100">
                <th className="w-[6%] border border-slate-300 px-2 py-1 text-left">#</th>
                <th className="w-[12%] border border-slate-300 px-2 py-1 text-left">Item</th>
                <th className="w-[24%] border border-slate-300 px-2 py-1 text-left">Part Number</th>
                <th className="w-[38%] border border-slate-300 px-2 py-1 text-left">Description</th>
                <th className="w-[10%] border border-slate-300 px-2 py-1 text-left">Qty</th>
                <th className="w-[10%] border border-slate-300 px-2 py-1 text-left">Unit</th>
              </tr>
            </thead>
            <tbody>
              {paddedLines.map((line, index) => (
                <tr key={line.id || index}>
                  <td className="h-7 border border-slate-300 px-2 py-1 text-center font-semibold text-slate-500">{index + 1}</td>
                  <td className="border border-slate-300 px-2 py-1">{line.item || ''}</td>
                  <td className="border border-slate-300 px-2 py-1">{line.part_number || ''}</td>
                  <td className="border border-slate-300 px-2 py-1">{line.description || ''}</td>
                  <td className="border border-slate-300 px-2 py-1 text-right">{line.qty ?? ''}</td>
                  <td className="border border-slate-300 px-2 py-1">{line.unit || ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide">Notes</p>
            <p className="min-h-24 whitespace-pre-line border border-slate-300 p-2 text-xs">{bom.notes || ''}</p>
          </div>
          <table className="h-fit w-full border border-slate-300 text-xs">
            <tbody>
              <tr>
                <td className="w-[42%] border border-slate-300 bg-slate-50 px-2 py-1 font-semibold">Authorized By</td>
                <td className="border border-slate-300 px-2 py-1">{bom.authorized_by || '-'}</td>
              </tr>
              <tr>
                <td className="border border-slate-300 bg-slate-50 px-2 py-1 font-semibold">Authorized Date</td>
                <td className="border border-slate-300 px-2 py-1">{displayDate(bom.authorized_date)}</td>
              </tr>
            </tbody>
          </table>
        </section>
      </article>
    </div>
  );
}
