import Link from 'next/link';
import { unstable_noStore as noStore } from 'next/cache';
import { redirect } from 'next/navigation';
import { SectionHeader } from '@/components/section-header';
import { getCurrentUserProfile } from '@/lib/auth/profile';
import { canSubmitPullRequests } from '@/lib/auth/roles';
import { supabaseAdmin } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

type PullRequestHeader = {
  id: string;
  [key: string]: unknown;
};

type PullRequestLine = {
  id?: string | number | null;
  [key: string]: unknown;
};

function readString(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];

    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }

    if (typeof value === 'number' && Number.isFinite(value)) {
      return String(value);
    }
  }

  return '';
}

function readQuantity(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];

    if (typeof value === 'number' && Number.isFinite(value)) {
      return String(value);
    }

    if (typeof value === 'string' && value.trim()) {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? String(parsed) : value.trim();
    }
  }

  return '-';
}

function formatDateTime(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) return '-';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString();
}

function readDateTime(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];

    if (typeof value === 'string' && value.trim()) {
      return formatDateTime(value);
    }
  }

  return '-';
}

function displayValue(value: string) {
  return value || '-';
}

function statusBadgeClass(status: string) {
  const normalized = status.toLowerCase();

  if (normalized.includes('closed') || normalized.includes('fulfilled')) {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  }

  if (normalized.includes('cancel') || normalized.includes('reject')) {
    return 'border-rose-200 bg-rose-50 text-rose-700';
  }

  if (normalized.includes('partial') || normalized.includes('progress')) {
    return 'border-amber-200 bg-amber-50 text-amber-700';
  }

  return 'border-cyan-200 bg-cyan-50 text-cyan-700';
}

function NotFoundPanel({ requestId }: { requestId: string }) {
  return (
    <div className="space-y-4">
      <SectionHeader
        title="Pull Request"
        subtitle="No matching pull request was found."
        actions={
          <Link href="/pull-requests" className="erp-button">
            Back to Pull Requests
          </Link>
        }
      />

      <div className="erp-panel p-6">
        <div className="text-sm font-semibold text-slate-900">Request not found</div>
        <p className="mt-2 text-sm text-slate-600">
          Pull request {requestId} may have been removed, or the link may point to a request that is
          not available in this workspace.
        </p>
      </div>
    </div>
  );
}

export default async function PullRequestDetailPage({
  params,
}: {
  params: { requestId: string };
}) {
  noStore();

  const profile = await getCurrentUserProfile();

  if (!canSubmitPullRequests(profile.role)) {
    redirect('/inventory');
  }

  const supabase = await supabaseAdmin();

  const [{ data: request, error: requestError }, { data: lineData, error: lineError }] =
    await Promise.all([
      supabase.from('pull_requests').select('*').eq('id', params.requestId).maybeSingle(),
      supabase
        .from('pull_request_lines')
        .select('*')
        .eq('request_id', params.requestId)
        .order('id', { ascending: true }),
    ]);

  if (requestError) {
    throw new Error(requestError.message);
  }

  if (!request) {
    return <NotFoundPanel requestId={params.requestId} />;
  }

  const header = request as PullRequestHeader;
  const lines = lineError ? [] : ((lineData ?? []) as PullRequestLine[]);
  const requestNumber = readString(header, ['request_number', 'requestNumber']) || header.id;
  const status = readString(header, ['status']) || 'OPEN';
  const requestedBy = readString(header, ['requested_by', 'requestedBy', 'created_by']);
  const neededBy = readDateTime(header, [
    'needed_by',
    'needed_date',
    'neededDate',
    'required_by',
    'required_date',
    'due_date',
  ]);
  const createdAt = readDateTime(header, ['created_at', 'createdAt']);
  const updatedAt = readDateTime(header, ['updated_at', 'updatedAt', 'modified_at']);
  const notes = readString(header, ['notes', 'request_notes', 'comments']);

  return (
    <div className="space-y-4">
      <SectionHeader
        title={`Pull Request ${requestNumber}`}
        subtitle="Request details and line item status."
        actions={
          <Link href="/pull-requests" className="erp-button">
            Back to Pull Requests
          </Link>
        }
      />

      <div className="erp-panel p-4">
        <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Request Number
            </div>
            <div className="mt-1 text-lg font-semibold text-slate-900">{requestNumber}</div>
            <div className="mt-1 text-xs text-slate-500">Request ID: {header.id}</div>
          </div>

          <span
            className={`inline-flex w-fit rounded-md border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${statusBadgeClass(
              status
            )}`}
          >
            {status}
          </span>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Requested By
            </div>
            <div className="mt-1 text-sm font-semibold text-slate-900">
              {displayValue(requestedBy)}
            </div>
          </div>

          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Needed By
            </div>
            <div className="mt-1 text-sm font-semibold text-slate-900">{neededBy}</div>
          </div>

          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Created At
            </div>
            <div className="mt-1 text-sm font-semibold text-slate-900">{createdAt}</div>
          </div>

          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Updated At
            </div>
            <div className="mt-1 text-sm font-semibold text-slate-900">{updatedAt}</div>
          </div>

          <div className="md:col-span-2 xl:col-span-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Notes
            </div>
            <div className="mt-1 whitespace-pre-wrap text-sm text-slate-700">
              {displayValue(notes)}
            </div>
          </div>
        </div>
      </div>

      <div className="erp-panel overflow-hidden">
        <div className="border-b border-slate-200 px-4 py-3">
          <div className="text-sm font-semibold text-slate-900">Line Items</div>
          <div className="text-xs text-slate-500">
            {lineError
              ? 'Line items could not be loaded.'
              : `${lines.length} line item${lines.length === 1 ? '' : 's'}`}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Item ID</th>
                <th className="px-4 py-3">Part Number</th>
                <th className="px-4 py-3">Description</th>
                <th className="px-4 py-3">Requested</th>
                <th className="px-4 py-3">Fulfilled</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {lines.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                    {lineError
                      ? 'Line items are unavailable.'
                      : 'No line items found for this pull request.'}
                  </td>
                </tr>
              ) : (
                lines.map((line, index) => {
                  const record = line as Record<string, unknown>;
                  const itemId = readString(record, ['item_id', 'itemId']);
                  const partNumber = readString(record, ['part_number', 'partNumber']);
                  const description = readString(record, ['description', 'item_description']);
                  const quantityRequested = readQuantity(record, [
                    'quantity',
                    'qty',
                    'qty_requested',
                    'quantity_requested',
                    'requested_quantity',
                  ]);
                  const quantityFulfilled = readQuantity(record, [
                    'quantity_fulfilled',
                    'fulfilled_quantity',
                    'fulfilled_qty',
                    'qty_fulfilled',
                  ]);
                  const lineStatus = readString(record, [
                    'status',
                    'line_status',
                    'fulfillment_status',
                  ]);

                  return (
                    <tr key={String(line.id ?? index)} className="border-b border-slate-100 align-top">
                      <td className="px-4 py-3 font-medium text-slate-900">
                        {displayValue(itemId)}
                      </td>
                      <td className="px-4 py-3 text-slate-700">{displayValue(partNumber)}</td>
                      <td className="px-4 py-3 text-slate-700">{displayValue(description)}</td>
                      <td className="px-4 py-3 text-slate-700">{quantityRequested}</td>
                      <td className="px-4 py-3 text-slate-700">{quantityFulfilled}</td>
                      <td className="px-4 py-3 text-slate-700">{displayValue(lineStatus)}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
