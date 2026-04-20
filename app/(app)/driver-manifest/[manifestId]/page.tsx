import Image from 'next/image';
import Link from 'next/link';
import { revalidatePath } from 'next/cache';
import { notFound } from 'next/navigation';
import { PrintManifestButton } from '@/components/manifest/print-manifest-button';
import { supabaseRest } from '@/lib/supabase/rest';

type ManifestHeader = {
  id: string;
  manifest_number: string | null;
  document_title: string | null;
  direction: string | null;
  manifest_date: string | null;
  manifest_time: string | null;
  status: string | null;
  shipment_transfer_id: string | null;
  driver_carrier: string | null;
  vehicle: string | null;
  reference_project_work_order: string | null;
  from_location: string | null;
  to_location: string | null;
  authorized_for_release_by: string | null;
  released_to_print_name: string | null;
  company: string | null;
  signature: string | null;
  id_verified_by: string | null;
  received_by: string | null;
  notes: string | null;
};

type ManifestLine = {
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

function displayTime(value: string | null) {
  if (!value) return '-';
  return value.slice(0, 5);
}

export default async function ManifestDetailPage({ params }: { params: { manifestId: string } }) {
  const [manifest] = await supabaseRest<ManifestHeader[]>('manifests', {
    params: {
      select:
        'id,manifest_number,document_title,direction,manifest_date,manifest_time,status,shipment_transfer_id,driver_carrier,vehicle,reference_project_work_order,from_location,to_location,authorized_for_release_by,released_to_print_name,company,signature,id_verified_by,received_by,notes',
      id: `eq.${params.manifestId}`,
      limit: 1,
    },
  });

  if (!manifest) notFound();

  const lines = await supabaseRest<ManifestLine[]>('manifest_lines', {
    params: {
      select: 'id,line_number,item,part_number,description,qty,unit',
      manifest_id: `eq.${params.manifestId}`,
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

  async function markPrinted() {
    'use server';

    await supabaseRest('manifests', {
      method: 'PATCH',
      params: { id: `eq.${params.manifestId}` },
      body: { status: 'Printed' },
      prefer: 'return=minimal',
    });

    revalidatePath('/delivery');
    revalidatePath('/driver-manifest');
    revalidatePath(`/driver-manifest/${params.manifestId}`);
  }

  async function markCompleted() {
    'use server';

    await supabaseRest('manifests', {
      method: 'PATCH',
      params: { id: `eq.${params.manifestId}` },
      body: { status: 'Completed' },
      prefer: 'return=minimal',
    });

    revalidatePath('/delivery');
    revalidatePath('/driver-manifest');
    revalidatePath(`/driver-manifest/${params.manifestId}`);
  }

  return (
    <div className="mx-auto max-w-5xl space-y-3 print:max-w-none print:space-y-0">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between print:hidden">
        <div className="flex flex-col gap-2 sm:flex-row">
          <Link href="/delivery?view=manifest" className="rounded border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
            Back to Delivery
          </Link>
          <Link href="/driver-manifest/new" className="rounded border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
            Create Manifest
          </Link>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <form action={markCompleted}>
            <button type="submit" className="rounded border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
              Mark Completed
            </button>
          </form>
          <PrintManifestButton markPrinted={markPrinted} />
        </div>
      </div>

      <article className="erp-card relative bg-white p-3 text-[13px] text-slate-900 sm:p-5 print:rounded-none print:border-slate-400 print:p-4 print:shadow-none">
        <Image
          src="/logo.png"
          alt=""
          width={420}
          height={260}
          className="pointer-events-none absolute left-1/2 top-1/2 z-0 hidden -translate-x-1/2 -translate-y-1/2 opacity-[0.06] print:block"
        />

        <div className="relative z-10">
          <header className="mb-3 border-b border-slate-300 pb-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">SEA991 Material Transfer</p>
            <h1 className="text-base font-bold tracking-[0.08em]">{manifest.document_title || 'Material Manifest'}</h1>
          </header>

          <section className="mb-3 grid grid-cols-1 gap-2 rounded border border-slate-300 bg-slate-50 p-2 text-xs sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="font-semibold uppercase tracking-wide text-slate-500">Manifest #</p>
              <p className="text-sm font-bold text-slate-900">{manifest.manifest_number || '-'}</p>
            </div>
            <div>
              <p className="font-semibold uppercase tracking-wide text-slate-500">Date</p>
              <p className="text-sm font-semibold text-slate-900">{displayDate(manifest.manifest_date)}</p>
            </div>
            <div>
              <p className="font-semibold uppercase tracking-wide text-slate-500">Time</p>
              <p className="text-sm font-semibold text-slate-900">{displayTime(manifest.manifest_time)}</p>
            </div>
            <div>
              <p className="font-semibold uppercase tracking-wide text-slate-500">Status</p>
              <p className="text-sm font-semibold text-slate-900">{manifest.status || 'Draft'}</p>
            </div>
          </section>

          <section className="grid grid-cols-1 gap-3 border-b border-slate-300 pb-3 md:grid-cols-2">
            <table className="w-full border border-slate-300 text-xs">
              <tbody>
                <tr>
                  <td className="w-[42%] border border-slate-300 bg-slate-50 px-2 py-1 font-semibold">Shipment ID / Transfer ID</td>
                  <td className="border border-slate-300 px-2 py-1">{manifest.shipment_transfer_id || '-'}</td>
                </tr>
                <tr>
                  <td className="border border-slate-300 bg-slate-50 px-2 py-1 font-semibold">Driver / Carrier</td>
                  <td className="border border-slate-300 px-2 py-1">{manifest.driver_carrier || '-'}</td>
                </tr>
                <tr>
                  <td className="border border-slate-300 bg-slate-50 px-2 py-1 font-semibold">Vehicle</td>
                  <td className="border border-slate-300 px-2 py-1">{manifest.vehicle || '-'}</td>
                </tr>
                <tr>
                  <td className="border border-slate-300 bg-slate-50 px-2 py-1 font-semibold">Reference / Project / Work Order</td>
                  <td className="border border-slate-300 px-2 py-1">{manifest.reference_project_work_order || '-'}</td>
                </tr>
                <tr>
                  <td className="border border-slate-300 bg-slate-50 px-2 py-1 font-semibold">Document ID</td>
                  <td className="border border-slate-300 px-2 py-1">{manifest.id}</td>
                </tr>
              </tbody>
            </table>

            <div className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
              <div>
                <p className="mb-1 font-semibold uppercase tracking-wide">From Location</p>
                <p className="min-h-40 whitespace-pre-line border border-slate-300 p-2">{manifest.from_location || '-'}</p>
              </div>
              <div>
                <p className="mb-1 font-semibold uppercase tracking-wide">To Location</p>
                <p className="min-h-40 whitespace-pre-line border border-slate-300 p-2">{manifest.to_location || '-'}</p>
              </div>
            </div>
          </section>

          <section className="mt-3">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-700">Manifest Lines</p>
            <div className="space-y-2 md:hidden">
              {lines.length === 0 ? (
                <p className="rounded border border-slate-300 p-3 text-sm text-slate-500">No manifest lines saved.</p>
              ) : (
                lines.map((line, index) => (
                  <div key={line.id || index} className="rounded border border-slate-300 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-xs font-semibold uppercase text-slate-500">Part Number</div>
                        <div className="mt-1 font-semibold text-slate-900">{line.part_number || line.item || '-'}</div>
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
              <p className="min-h-24 whitespace-pre-line border border-slate-300 p-2 text-xs">{manifest.notes || ''}</p>
            </div>
            <table className="h-fit w-full border border-slate-300 text-xs">
              <tbody>
                <tr>
                  <td className="w-[42%] border border-slate-300 bg-slate-50 px-2 py-1 font-semibold">Authorized for Release By</td>
                  <td className="border border-slate-300 px-2 py-1">{manifest.authorized_for_release_by || '-'}</td>
                </tr>
                <tr>
                  <td className="border border-slate-300 bg-slate-50 px-2 py-1 font-semibold">Released To (Print Name)</td>
                  <td className="border border-slate-300 px-2 py-1">{manifest.released_to_print_name || '-'}</td>
                </tr>
                <tr>
                  <td className="border border-slate-300 bg-slate-50 px-2 py-1 font-semibold">Company</td>
                  <td className="border border-slate-300 px-2 py-1">{manifest.company || '-'}</td>
                </tr>
                <tr>
                  <td className="border border-slate-300 bg-slate-50 px-2 py-1 font-semibold">ID Verified By</td>
                  <td className="border border-slate-300 px-2 py-1">{manifest.id_verified_by || '-'}</td>
                </tr>
                <tr>
                  <td className="border border-slate-300 bg-slate-50 px-2 py-1 font-semibold">Received By</td>
                  <td className="border border-slate-300 px-2 py-1">{manifest.received_by || '-'}</td>
                </tr>
              </tbody>
            </table>
          </section>

          <section className="mt-3 border border-slate-300 p-2 text-xs">
            <p className="font-semibold">
              Items listed above are transferred in good condition. Responsibility transfers upon signature unless otherwise noted.
            </p>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Signature</p>
                <p className="mt-8 border-t border-slate-400 pt-1">{manifest.signature || ''}</p>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Released To</p>
                <p className="mt-8 border-t border-slate-400 pt-1">{manifest.released_to_print_name || ''}</p>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Received By</p>
                <p className="mt-8 border-t border-slate-400 pt-1">{manifest.received_by || ''}</p>
              </div>
            </div>
          </section>
        </div>
      </article>
    </div>
  );
}
