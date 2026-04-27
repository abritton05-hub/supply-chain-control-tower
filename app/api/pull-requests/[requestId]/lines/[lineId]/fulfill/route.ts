import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';
import { logActivity } from '@/lib/activity/log-activity';
import { getCurrentUserEmail } from '@/lib/auth/session';
import { canFulfillPullRequests } from '@/lib/auth/roles';
import { getCurrentUserProfile } from '@/lib/auth/profile';
import { supabaseAdmin } from '@/lib/supabase/admin';

type FulfillLineRequestBody = {
  request_id?: string;
  requestId?: string;
  line_id?: string;
  lineId?: string;
  fulfill_quantity?: number | string;
  fulfillQuantity?: number | string;
  quantity?: number | string;
};

type FulfillLineRpcResult = {
  request_id?: string;
  line_id?: string;
  item_id?: string | null;
  part_number?: string | null;
  quantity_fulfilled?: number;
  line_quantity_fulfilled?: number;
  remaining_quantity?: number;
  line_status?: string;
  request_status?: string;
  transaction_id?: string | null;
};

const MIGRATION_MESSAGE =
  'Pull request fulfillment schema is not installed. Apply docs/supabase-pull-request-fulfillment.sql, then retry.';

function clean(value: string | null | undefined) {
  return value?.trim() || '';
}

function quantityFromBody(body: FulfillLineRequestBody) {
  const value = body.fulfill_quantity ?? body.fulfillQuantity ?? body.quantity;
  const quantity = typeof value === 'string' ? Number(value) : value;

  return Number.isFinite(quantity) ? Number(quantity) : 0;
}

function isMissingFulfillmentMigration(error: { code?: string; message?: string }) {
  const message = error.message?.toLowerCase() ?? '';

  return (
    error.code === '42883' ||
    error.code === '42703' ||
    error.code === 'PGRST202' ||
    message.includes('fulfill_pull_request_line') ||
    message.includes('quantity_fulfilled') ||
    message.includes('fulfillment_status')
  );
}

function validationStatus(error: { code?: string }) {
  if (error.code === '22023' || error.code === 'P0002') {
    return 400;
  }

  return 500;
}

export async function POST(
  request: Request,
  {
    params,
  }: {
    params: { requestId: string; lineId: string };
  }
) {
  try {
    const profile = await getCurrentUserProfile();

    if (!canFulfillPullRequests(profile.role)) {
      return NextResponse.json(
        {
          ok: false,
          message: 'Only warehouse and admin users can fulfill pull request lines.',
        },
        { status: 403 }
      );
    }

    const body = (await request.json()) as FulfillLineRequestBody;
    const requestId = clean(body.request_id) || clean(body.requestId) || clean(params.requestId);
    const lineId = clean(body.line_id) || clean(body.lineId) || clean(params.lineId);
    const fulfillQuantity = quantityFromBody(body);

    if (!requestId || !lineId) {
      return NextResponse.json(
        {
          ok: false,
          message: 'Request ID and line ID are required.',
        },
        { status: 400 }
      );
    }

    if (
      (clean(body.request_id) || clean(body.requestId)) &&
      (clean(body.request_id) || clean(body.requestId)) !== params.requestId
    ) {
      return NextResponse.json(
        {
          ok: false,
          message: 'Request ID in the request body does not match the route.',
        },
        { status: 400 }
      );
    }

    if (
      (clean(body.line_id) || clean(body.lineId)) &&
      (clean(body.line_id) || clean(body.lineId)) !== params.lineId
    ) {
      return NextResponse.json(
        {
          ok: false,
          message: 'Line ID in the request body does not match the route.',
        },
        { status: 400 }
      );
    }

    if (fulfillQuantity <= 0) {
      return NextResponse.json(
        {
          ok: false,
          message: 'Fulfill quantity must be greater than 0.',
        },
        { status: 400 }
      );
    }

    const supabase = await supabaseAdmin();
    const currentUserEmail = await getCurrentUserEmail();
    const performedBy = profile.email || currentUserEmail || 'unknown';

    const { data, error } = await supabase.rpc('fulfill_pull_request_line', {
      p_request_id: requestId,
      p_line_id: lineId,
      p_fulfill_quantity: fulfillQuantity,
      p_performed_by: performedBy,
    });

    if (error) {
      const isMissingMigration = isMissingFulfillmentMigration(error);

      return NextResponse.json(
        {
          ok: false,
          message: isMissingMigration ? MIGRATION_MESSAGE : error.message,
        },
        { status: isMissingMigration ? 500 : validationStatus(error) }
      );
    }

    const result = (data ?? {}) as FulfillLineRpcResult;
    const activity = await logActivity({
      entityType: 'pull_request_line',
      entityId: lineId,
      actionType: 'PULL_REQUEST_LINE_FULFILLED',
      title: `Pull request line fulfilled`,
      details: {
        request_id: requestId,
        line_id: lineId,
        item_id: result.item_id ?? null,
        part_number: result.part_number ?? null,
        fulfill_quantity: fulfillQuantity,
        line_quantity_fulfilled:
          result.line_quantity_fulfilled ?? result.quantity_fulfilled ?? null,
        remaining_quantity: result.remaining_quantity ?? null,
        line_status: result.line_status ?? null,
        request_status: result.request_status ?? null,
        transaction_id: result.transaction_id ?? null,
      },
      referenceNumber: requestId,
      userName: performedBy,
    });

    if (!activity.ok) {
      console.error('Pull request fulfillment activity logging failed', {
        requestId,
        lineId,
        error: 'message' in activity ? activity.message : 'Failed to write activity log.',
      });
    }

    revalidatePath('/pull-requests');
    revalidatePath(`/pull-requests/${requestId}`);
    revalidatePath('/inventory');
    revalidatePath('/transactions');
    revalidatePath('/dashboard');

    if (result.item_id) {
      revalidatePath(`/inventory/${result.item_id}`);
    }

    return NextResponse.json({
      ok: true,
      message: 'Pull request line fulfilled.',
      result,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : 'Failed to fulfill pull request line.',
      },
      { status: 500 }
    );
  }
}
