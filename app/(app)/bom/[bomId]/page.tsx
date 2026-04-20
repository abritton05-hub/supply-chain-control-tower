import Image from 'next/image';
import Link from 'next/link';
import { revalidatePath } from 'next/cache';
import { notFound } from 'next/navigation';
import { PrintBomButton } from '@/components/bom/print-bom-button';
import { PrintOnLoad } from '@/components/bom/print-on-load';
import { supabaseRest } from '@/lib/supabase/rest';

type BomHeader = {
  id: string;
  bom_number: string | null;
  bom_date: string | null;
  status: string | null;
  project_job_number: string | null;
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
  part_number: string | null;
  description: string | null;
  qty: number | null;
  unit: string | null;
};

function displayDate(value: string | null) {
  if (!value) return '-';
  return new Date(`${value}T00:00:00`).toLocaleDateString();
}

function isMissingStatusColumn(error: unknown) {
  const message = error instanceof Error ? error.message : '';
  return (
    message.includes('column boms.status does not exist') ||
    (message.includes("Could not find") && message.includes("'status'") && message.includes("'boms'")) ||
    (message.includes('PGRST204') && message.includes('status') && message.includes('boms'))
  );
}

async function getBom(bomId: string) {
  try {
    const [bom] = await supabaseRest<BomHeader[]>('boms', {
      params: {
        select:
          'id,bom_number,bom_date,status,project_job_number,ship_from,ship_to,po_number,reference_number,requested_by,notes,authorized_by,authorized_date',
        id: `eq.${bomId}`,
        limit: 1,
      },
    });

    return bom;
  } catch (error) {
    if (!isMissingStatusColumn(error)) throw error;

    const [bom] = await supabaseRest<Omit<BomHeader, 'status'>[]>('boms', {
      params: {
        select:
          'id,bom_number,bom_date,project_job_number,ship_from,ship_to,po_number,reference_number,requested_by,notes,authorized_by,authorized_date',
        id: `eq.${bomId}`,
        limit: 1,
      },
    });

    return bom ? { ...bom, status: null } : undefined;
  }
}

export default async function BomDetailPage({
  params,
  searchParams,
}: {
  params: { bomId: string };
  searchParams?: { print?: string };
}) {
  const bom = await getBom(params.bomId);

  if (!bom) notFound();

  const lines = await supabaseRest<BomLine[]>('bom_lines', {
    params: {
      select: 'id,line_number,part_number,description,qty,unit',
      bom_id: `eq.${params.bomId}`,
      order: 'line_number.asc.nullslast',
    },
  });

  const paddedLines = [...lines];
  while (paddedLines.length < 10) {
    paddedLines.push({
      id: `blank-${paddedLines.length}`,
      line_number: null,
      part_number: '',
      description: '',
      qty: null,
      unit: '',
    });
  }

  async function markPrinted() {
    'use server';

    try {
      await supabaseRest('boms', {
        method: 'PATCH',
        params: { id: `eq.${params.bomId}` },
        body: { status: 'Printed' },
        prefer: 'return=minimal',
      });
    } catch (error) {
      if (!isMissingStatusColumn(error)) throw error;
    }

    revalidatePath('/delivery');
    revalidatePath('/bom');
    revalidatePath(`/bom/${params.bomId}`);
  }

  return (
    <div className="mx-auto max-w-5xl space-y-3 print:max-w-none print:space-y-0">
      <PrintOnLoad enabled={searchParams?.print === '1'} />

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between print:hidden">
        <div className="flex flex-col gap-2 sm:flex-row">
          <Link
            href="/delivery?view=bom"
            className="rounded border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Back to Delivery
          </Link>
          <Link
            href="/bom/new"
            className="rounded border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Create BOM / Release
          </Link>
        </div>
        <PrintBomButton markPrinted={markPrinted} />
      </div>

      <article className="erp-card bg-white p-3 text-[13px] text-slate-900 sm:p-5 print:rounded-none print:border-slate-400 print:p-4 print:shadow-none">
        <header className="mb-3 border-b border-slate-300 pb-3">
          <div className="flex items-start justify-between gap-4">
            <h1 className="text-base font-bold tracking-[0.08em]">BILL OF MATERIALS</h1>
            <div className="shrink-0">
              <Image
                src="/denali-logo.png"
                alt="Denali logo"
                width={220}
                height={90}
                className="h-auto w-[180px] sm:w-[220px]"
                priority
              />
            </div>
          </div>
        </header>

        <section className="mb-3 grid grid-cols-1 gap-2 rounded border border-slate-300 bg-slate-50 p-2 text-xs sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <p className="font-semibold uppercase tracking-wide text-slate-500">BOM #</p>
            <p className="text-sm font-bold text-slate-900">{bom.bom_number || '-'}</p>
          </div>
          <div>
            <p className="font-semibold uppercase tracking-wide text-slate-500">Date</p>
            <p className="text-sm font-semibold text-slate-900">{displayDate(bom.bom_date)}</p>
          </div>
          <div>
            <p className="font-semibold uppercase tracking-wide text-slate-500">Project / Job #</p>
            <p className="text-sm font-semibold text-slate-900">{bom.project_job_number || '-'}</p>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-3 border-b border-slate-300 pb-3 md:grid-cols-2">
          <table className="w-full border border-slate-300 text-xs">
            <tbody>
              <tr>
                <td className="w-[40%] border border-slate-300 bg-slate-50 px-2 py-1 font-semibold">
                  PO #
                </td>
                <td className="border border-slate-300 px-2 py-1">{bom.po_number || '-'}</td>
              </tr>
              <tr>
                <td className="border border-slate-300 bg-slate-50 px-2 py-1 font-semibold">
                  Reference #
                </td>
                <td className="border border-slate-300 px-2 py-1">{bom.reference_number || '-'}</td>
              </tr>
              <tr>
                <td className="border border-slate-300 bg-slate-50 px-2 py-1 font-semibold">
                  Requested By
                </td>
                <td className="border border-slate-300 px-2 py-1">{bom.requested_by || '-'}</td>
              </tr>
            </tbody>
          </table>

          <div className="space-y-2 text-xs">
            <div>
              <p className="mb-1 font-semibold uppercase tracking-wide">Ship From</p>
              <p className="min-h-20 whitespace-pre-line border border-slate-300 p-2">
                {bom.ship_from || '-'}
              </p>
            </div>
            <div>
              <p className="mb-1 font-semibold uppercase tracking-wide">Ship To</p>
              <p className="min-h-20 whitespace-pre-line border border-slate-300 p-2">
                {bom.ship_to || '-'}
              </p>
            </div>
          </div>
        </section>

        <section className="mt-3">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-700">
            Materials
          </p>

          <div className="space-y-2 md:hidden">
            {lines.length === 0 ? (
              <p className="rounded border border-slate-300 p-3 text-sm text-slate-500">
                No material lines saved.
              </p>
            ) : (
              lines.map((line, index) => (
                <div key={line.id || index} className="rounded border border-slate-300 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-xs font-semibold uppercase text-slate-500">
                        Part Number
                      </div>
                      <div className="mt-1 font-semibold text-slate-900">
                        {line.part_number || '-'}
                      </div>
                    </div>
                    <div className="rounded border border-slate-200 px-2 py-1 text-sm font-semibold">
                      Qty {line.qty ?? '-'} {line.unit || ''}
                    </div>
                  </div>
                  <div className="mt-2 text-sm text-slate-700">{line.description || '-'}</div>
                </div>
              ))
            )}
          </div>

          <table className="hidden min-w-full table-fixed border border-slate-300 text-xs md:table">
            <thead>
              <tr className="bg-slate-100">
                <th className="w-[8%] border border-slate-300 px-2 py-1 text-left">#</th>
                <th className="w-[28%] border border-slate-300 px-2 py-1 text-left">
                  Part Number
                </th>
                <th className="w-[44%] border border-slate-300 px-2 py-1 text-left">
                  Description
                </th>
                <th className="w-[10%] border border-slate-300 px-2 py-1 text-left">Qty</th>
                <th className="w-[10%] border border-slate-300 px-2 py-1 text-left">Unit</th>
              </tr>
            </thead>
            <tbody>
              {paddedLines.map((line, index) => (
                <tr key={line.id || index}>
                  <td className="h-7 border border-slate-300 px-2 py-1 text-center font-semibold text-slate-500">
                    {index + 1}
                  </td>
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
            <p className="min-h-24 whitespace-pre-line border border-slate-300 p-2 text-xs">
              {bom.notes || ''}
            </p>
          </div>
          <table className="h-fit w-full border border-slate-300 text-xs">
            <tbody>
              <tr>
                <td className="w-[42%] border border-slate-300 bg-slate-50 px-2 py-1 font-semibold">
                  Authorized By
                </td>
                <td className="border border-slate-300 px-2 py-1">{bom.authorized_by || '-'}</td>
              </tr>
              <tr>
                <td className="border border-slate-300 bg-slate-50 px-2 py-1 font-semibold">
                  Authorized Date
                </td>
                <td className="border border-slate-300 px-2 py-1">
                  {displayDate(bom.authorized_date)}
                </td>
              </tr>
            </tbody>
          </table>
        </section>
      </article>
    </div>
  );
}