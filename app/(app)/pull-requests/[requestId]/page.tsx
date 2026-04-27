import Link from 'next/link';
import { unstable_noStore as noStore } from 'next/cache';
import { redirect } from 'next/navigation';
import { SectionHeader } from '@/components/section-header';
import { RelatedAlerts } from '@/components/related-alerts';
import { StickyNotes } from '@/components/sticky-notes';
import { getCurrentUserProfile } from '@/lib/auth/profile';
import { canFulfillPullRequests, canSubmitPullRequests } from '@/lib/auth/roles';
import { supabaseAdmin } from '@/lib/supabase/admin';
import {
  PullRequestFulfillmentClient,
  type FulfillmentLineView,
} from './pull-request-fulfillment-client';

export const dynamic = 'force-dynamic';

type PullRequestHeader = {
  id: string;
  [key: string]: unknown;
};

type PullRequestLine = {
  id?: string | number | null;
  [key: string]: unknown;
};

type InventoryAvailabilityRow = {
  item_id: string | null;
  part_number: string | null;
  qty_on_hand: number | null;
  location: string | null;
  site: string | null;
  bin_location: string | null;
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

function readNumber(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];

    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === 'string' && value.trim()) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }

  return 0;
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

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function inventoryLocation(row: InventoryAvailabilityRow | undefined, fallback: string) {
  const location = [row?.site || row?.location, row?.bin_location].filter(Boolean).join(' / ');

  return location || fallback;
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

  let requestResult = isUuid(params.requestId)
    ? await supabase.from('pull_requests').select('*').eq('id', params.requestId).maybeSingle()
    : await supabase
        .from('pull_requests')
        .select('*')
        .eq('request_number', params.requestId)
        .maybeSingle();

  if (!requestResult.data && isUuid(params.requestId) && !requestResult.error) {
    requestResult = await supabase
      .from('pull_requests')
      .select('*')
      .eq('request_number', params.requestId)
      .maybeSingle();
  }

  if (requestResult.error) {
    throw new Error(requestResult.error.message);
  }

  if (!requestResult.data) {
    return <NotFoundPanel requestId={params.requestId} />;
  }

  const header = requestResult.data as PullRequestHeader;
  const requestNumber = readString(header, ['request_number', 'requestNumber']) || header.id;
  let lineResult = await supabase
    .from('pull_request_lines')
    .select('*')
    .eq('request_id', header.id)
    .order('id', { ascending: true });

  if (!lineResult.error && (lineResult.data ?? []).length === 0 && requestNumber !== header.id) {
    const fallbackLineResult = await supabase
      .from('pull_request_lines')
      .select('*')
      .eq('request_id', requestNumber)
      .order('id', { ascending: true });

    if (!fallbackLineResult.error && (fallbackLineResult.data ?? []).length > 0) {
      lineResult = fallbackLineResult;
    }
  }

  const lines = lineResult.error ? [] : ((lineResult.data ?? []) as PullRequestLine[]);
  const itemIds = Array.from(
    new Set(
      lines
        .map((line) => readString(line as Record<string, unknown>, ['item_id', 'itemId']))
        .filter(Boolean)
    )
  );
  const partNumbers = Array.from(
    new Set(
      lines
        .map((line) => readString(line as Record<string, unknown>, ['part_number', 'partNumber']))
        .filter(Boolean)
    )
  );

  const [inventoryByItemIdResult, inventoryByPartNumberResult] = await Promise.all([
    itemIds.length
      ? supabase
          .from('inventory')
          .select('item_id,part_number,qty_on_hand,location,site,bin_location,is_active')
          .in('item_id', itemIds)
          .eq('is_active', true)
      : Promise.resolve({ data: [], error: null }),
    partNumbers.length
      ? supabase
          .from('inventory')
          .select('item_id,part_number,qty_on_hand,location,site,bin_location,is_active')
          .in('part_number', partNumbers)
          .eq('is_active', true)
      : Promise.resolve({ data: [], error: null }),
  ]);

  const inventoryByItemId = new Map<string, InventoryAvailabilityRow>();
  const inventoryByPartNumber = new Map<string, InventoryAvailabilityRow>();
  const inventoryRows = [
    ...((inventoryByItemIdResult.data ?? []) as InventoryAvailabilityRow[]),
    ...((inventoryByPartNumberResult.data ?? []) as InventoryAvailabilityRow[]),
  ];

  for (const row of inventoryRows) {
    if (row.item_id && !inventoryByItemId.has(row.item_id)) {
      inventoryByItemId.set(row.item_id, row);
    }
    if (row.part_number && !inventoryByPartNumber.has(row.part_number)) {
      inventoryByPartNumber.set(row.part_number, row);
    }
  }

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
  const lineLoadError =
    lineResult.error?.message ??
    inventoryByItemIdResult.error?.message ??
    inventoryByPartNumberResult.error?.message ??
    '';
  const fulfillmentLines: FulfillmentLineView[] = lines.map((line, index) => {
    const record = line as Record<string, unknown>;
    const itemId = readString(record, ['item_id', 'itemId']);
    const partNumber = readString(record, ['part_number', 'partNumber']);
    const inventory = inventoryByItemId.get(itemId) ?? inventoryByPartNumber.get(partNumber);
    const requestedQty = readNumber(record, [
      'quantity',
      'qty',
      'qty_requested',
      'quantity_requested',
      'requested_quantity',
    ]);
    const fulfilledQty = readNumber(record, [
      'quantity_fulfilled',
      'fulfilled_quantity',
      'fulfilled_qty',
      'qty_fulfilled',
    ]);

    return {
      id: String(line.id ?? index),
      itemId,
      partNumber,
      description: readString(record, ['description', 'item_description']),
      requestedQty,
      fulfilledQty,
      remainingQty: Math.max(requestedQty - fulfilledQty, 0),
      availableQty: Math.max(inventory?.qty_on_hand ?? 0, 0),
      location: inventoryLocation(inventory, readString(record, ['location'])),
      notes: readString(record, ['notes']),
      status:
        readString(record, ['fulfillment_status', 'status', 'line_status']) ||
        (fulfilledQty >= requestedQty && requestedQty > 0
          ? 'FULFILLED'
          : fulfilledQty > 0
            ? 'PARTIAL'
            : 'OPEN'),
    };
  });

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

      <StickyNotes entityType="pull_request" entityId={header.id} title="Pinned Notes" />

      <RelatedAlerts
        title="Pull Request Alerts"
        matchValues={[header.id, requestNumber]}
        matchTypes={['OPEN_PULL_REQUEST', 'PARTIAL_PULL_REQUEST']}
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

      <PullRequestFulfillmentClient
        requestId={header.id}
        canFulfill={canFulfillPullRequests(profile.role)}
        lines={fulfillmentLines}
        lineLoadError={lineLoadError}
      />
    </div>
  );
}
