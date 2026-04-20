import Link from 'next/link';
import { notFound } from 'next/navigation';
import { SectionHeader } from '@/components/section-header';
import { ResolvePullRequestButton } from '@/components/pull-requests/resolve-pull-request-button';
import { supabaseServer } from '@/lib/supabase/server';

type PullRequestHeader = {
  id: string;
  request_number: string | null;
  status: string | null;
  requested_by: string | null;
  created_at: string | null;
};

type PullRequestLine = {
  id: string;
  item_id: string | null;
  part_number: string | null;
  description: string | null;
  quantity: number | null;
  location: string | null;
  notes: string | null;
};

function formatDateTime(value: string | null) {
  if (!value) return '-';
  return new Date(value).toLocaleString();
}

export default async function PullRequestDetailPage({
  params,
}: {
  params: { requestId: string };
}) {
  const supabase = await supabaseServer();

  const { data: request, error: requestError } = await supabase
    .from('pull_requests')
    .select('id,request_number,status,requested_by,created_at')
    .eq('id', params.requestId)
    .single<PullRequestHeader>();

  if (requestError || !request) {
    notFound();
  }

  const { data: lines, error: lineError } = await supabase
    .from('pull_request_lines')
    .select('id,item_id,part_number,description,quantity,location,notes')
    .eq('request_id', params.requestId)
    .order('part_number', { ascending: true });

  return (
    <div className="space-y-4">
      <SectionHeader
        title={request.request_number || 'Pull Request'}
        subtitle="Review request lines and fulfill inventory"
      />

      <div className="flex flex-wrap gap-2">
        <Link
          href="/pull-requests"
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          Back to Pull Requests
        </Link>

        {request.status !== 'COMPLETED' ? (
          <ResolvePullRequestButton requestId={request.id} />
        ) : (
          <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">
            Already Completed
          </div>
        )}
      </div>

      <section className="erp-panel p-4">
        <div className="grid gap-4 md:grid-cols-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Request Number
            </div>
            <div className="mt-1 text-sm font-semibold text-slate-900">
              {request.request_number || '-'}
            </div>
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Status
            </div>
            <div className="mt-1 text-sm font-semibold text-slate-900">
              {request.status || 'OPEN'}
            </div>
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Requested By
            </div>
            <div className="mt-1 text-sm font-semibold text-slate-900">
              {request.requested_by || '-'}
            </div>
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Created At
            </div>
            <div className="mt-1 text-sm font-semibold text-slate-900">
              {formatDateTime(request.created_at)}
            </div>
          </div>
        </div>
      </section>

      <section className="erp-panel overflow-hidden">
        <div className="border-b border-slate-200 px-4 py-3">
          <div className="text-sm font-semibold text-slate-900">Requested Items</div>
        </div>

        {lineError ? (
          <div className="p-4 text-sm text-rose-700">Could not load request lines.</div>
        ) : !lines || lines.length === 0 ? (
          <div className="p-4 text-sm text-slate-500">No request lines found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Item ID</th>
                  <th className="px-4 py-3">Part Number</th>
                  <th className="px-4 py-3">Description</th>
                  <th className="px-4 py-3">Qty</th>
                  <th className="px-4 py-3">Location</th>
                  <th className="px-4 py-3">Notes</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line: PullRequestLine) => (
                  <tr key={line.id} className="border-b border-slate-100">
                    <td className="px-4 py-3">{line.item_id || '-'}</td>
                    <td className="px-4 py-3">{line.part_number || '-'}</td>
                    <td className="px-4 py-3">{line.description || '-'}</td>
                    <td className="px-4 py-3">{line.quantity ?? '-'}</td>
                    <td className="px-4 py-3">{line.location || '-'}</td>
                    <td className="px-4 py-3">{line.notes || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}