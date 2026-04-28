import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';
import { canFulfillPullRequests } from '@/lib/auth/roles';
import { getCurrentUserProfile } from '@/lib/auth/profile';
import { getCurrentUserEmail } from '@/lib/auth/session';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { logTransaction } from '@/lib/transactions/log-transaction';
import { logActivity } from '@/lib/activity/log-activity';

type UpdatePullRequestBody = {
  status?: string;
  notes?: string;
};

function clean(value: string | null | undefined) {
  return value?.trim() || '';
}

function isMissingResolutionColumn(error: { code?: string; message?: string }) {
  const message = error.message?.toLowerCase() ?? '';
  return error.code === '42703' || message.includes('resolved_by') || message.includes('resolved_at');
}

export async function PATCH(
  request: Request,
  {
    params,
  }: {
    params: { requestId: string };
  }
) {
  try {
    const profile = await getCurrentUserProfile();

    if (!canFulfillPullRequests(profile.role)) {
      return NextResponse.json(
        {
          ok: false,
          message: 'Only warehouse and admin users can close pull requests.',
        },
        { status: 403 }
      );
    }

    const requestId = clean(params.requestId);
    const body = (await request.json()) as UpdatePullRequestBody;
    const nextStatus = clean(body.status).toUpperCase();

    if (!requestId) {
      return NextResponse.json({ ok: false, message: 'Request ID is required.' }, { status: 400 });
    }

    if (nextStatus !== 'CLOSED') {
      return NextResponse.json(
        { ok: false, message: 'Only CLOSED status updates are supported here.' },
        { status: 400 }
      );
    }

    const supabase = await supabaseAdmin();
    const currentUserEmail = await getCurrentUserEmail();
    const performedBy = profile.email || currentUserEmail || 'unknown';

    const { data: existing, error: existingError } = await supabase
      .from('pull_requests')
      .select('id,request_number,status')
      .eq('id', requestId)
      .maybeSingle();

    if (existingError) {
      return NextResponse.json({ ok: false, message: existingError.message }, { status: 500 });
    }

    if (!existing) {
      return NextResponse.json({ ok: false, message: 'Pull request not found.' }, { status: 404 });
    }

    if (existing.status === 'CLOSED') {
      return NextResponse.json({
        ok: true,
        message: 'Pull request was already closed.',
        request: existing,
      });
    }

    const updatePayload = {
      status: 'CLOSED',
      resolved_by: performedBy,
      resolved_at: new Date().toISOString(),
    };

    let updateResult = await supabase
      .from('pull_requests')
      .update(updatePayload)
      .eq('id', requestId)
      .select('id,request_number,status')
      .maybeSingle();

    if (updateResult.error && isMissingResolutionColumn(updateResult.error)) {
      updateResult = await supabase
        .from('pull_requests')
        .update({ status: 'CLOSED' })
        .eq('id', requestId)
        .select('id,request_number,status')
        .maybeSingle();
    }

    if (updateResult.error || !updateResult.data) {
      return NextResponse.json(
        { ok: false, message: updateResult.error?.message || 'Failed to close pull request.' },
        { status: 500 }
      );
    }

    const logResult = await logTransaction({
      transaction_type: 'PULL_REQUEST_CLOSED',
      reference: updateResult.data.request_number || requestId,
      notes: clean(body.notes) || `Pull request ${updateResult.data.request_number || requestId} closed.`,
      performed_by: performedBy,
      entity_type: 'pull_request',
      entity_id: requestId,
      title: `Pull request ${updateResult.data.request_number || requestId} closed`,
      details: {
        request_id: requestId,
        request_number: updateResult.data.request_number,
        previous_status: existing.status,
        next_status: updateResult.data.status,
      },
      write_inventory_transaction: true,
      write_activity_log: true,
      supabase,
    });

    if (logResult.ok === false) {
      console.error('Pull request close transaction logging failed', {
        requestId,
        error: logResult.message,
      });
    }

    const activity = await logActivity({
      actionType: 'PULL_REQUEST_REJECTED_CANCELLED',
      module: 'pull_request',
      recordId: requestId,
      recordLabel: updateResult.data.request_number || requestId,
      actor: performedBy,
      details: { previous_status: existing.status, next_status: updateResult.data.status },
    });

    if (!activity.ok) {
      console.warn('Pull request status activity logging failed', activity.message);
    }

    revalidatePath('/pull-requests');
    revalidatePath(`/pull-requests/${requestId}`);
    revalidatePath('/transactions');
    revalidatePath('/dashboard');

    return NextResponse.json({
      ok: true,
      message: 'Pull request closed.',
      request: updateResult.data,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : 'Failed to close pull request.',
      },
      { status: 500 }
    );
  }
}


export async function DELETE(
  _request: Request,
  {
    params,
  }: {
    params: { requestId: string };
  }
) {
  try {
    const profile = await getCurrentUserProfile();

    if (!canFulfillPullRequests(profile.role)) {
      return NextResponse.json(
        {
          ok: false,
          message: 'Only warehouse and admin users can delete pull requests.',
        },
        { status: 403 }
      );
    }

    const requestId = clean(params.requestId);
    if (!requestId) {
      return NextResponse.json({ ok: false, message: 'Request ID is required.' }, { status: 400 });
    }

    const supabase = await supabaseAdmin();
    await supabase.from('pull_request_lines').delete().eq('request_id', requestId);
    const { error } = await supabase.from('pull_requests').delete().eq('id', requestId);

    if (error) {
      return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
    }

    const activity = await logActivity({
      actionType: 'PULL_REQUEST_ARCHIVED',
      module: 'pull_request',
      recordId: requestId,
      recordLabel: requestId,
      actor: profile.email || profile.full_name || 'unknown',
    });

    if (!activity.ok) {
      console.warn('Pull request delete logging failed', activity.message);
    }

    revalidatePath('/pull-requests');
    revalidatePath('/transactions');

    return NextResponse.json({ ok: true, message: 'Pull request deleted.' });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : 'Failed to delete pull request.',
      },
      { status: 500 }
    );
  }
}
