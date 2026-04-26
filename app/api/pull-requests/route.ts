import { NextResponse } from 'next/server';
import { getCurrentUserProfile } from '@/lib/auth/profile';
import { canSubmitPullRequests } from '@/lib/auth/roles';
import { getCurrentUserEmail } from '@/lib/auth/session';
import { logActivity } from '@/lib/activity/log-activity';
import { supabaseAdmin } from '@/lib/supabase/admin';

type PullRequestLineInput = {
  item_id?: string;
  part_number?: string;
  description?: string;
  location?: string;
  quantity?: number;
  notes?: string;
};

type PullRequestInput = {
  request_number?: string;
  requested_by?: string;
  lines?: PullRequestLineInput[];
};

type NotificationError = {
  message: string;
  code?: string;
  details?: string | null;
};

function clean(value: string | null | undefined) {
  return value?.trim() || '';
}

function normalizeLine(line: PullRequestLineInput) {
  return {
    item_id: clean(line.item_id) || null,
    part_number: clean(line.part_number) || null,
    description: clean(line.description) || null,
    location: clean(line.location) || null,
    quantity: Number(line.quantity) || 0,
    notes: clean(line.notes) || null,
  };
}

async function createPullRequestNotification(
  supabase: Awaited<ReturnType<typeof supabaseAdmin>>,
  pullRequest: { id: string; request_number: string | null },
  requestedBy: string
) {
  const href = `/pull-requests/${pullRequest.id}`;
  const requestNumber = pullRequest.request_number || pullRequest.id;
  const payload: Record<string, unknown> = {
    title: `New pull request ${requestNumber}`,
    message: `${requestedBy} submitted pull request ${requestNumber}.`,
    href,
    link: href,
    type: 'pull_request',
    category: 'pull_request',
    pull_request_id: pullRequest.id,
    entity_id: pullRequest.id,
    is_read: false,
    read_at: null,
  };

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const { error } = await supabase.from('notifications').insert(payload);

    if (!error) {
      return null;
    }

    if (isMissingNotificationsTable(error)) {
      return error;
    }

    const missingColumn = missingColumnFromError(error);
    if (missingColumn && missingColumn in payload) {
      delete payload[missingColumn];
      continue;
    }

    return error;
  }

  return null;
}

function isMissingNotificationsTable(error: NotificationError) {
  const message = error.message.toLowerCase();

  return (
    error.code === '42P01' ||
    error.code === 'PGRST205' ||
    (message.includes('relation') && message.includes('notifications')) ||
    (message.includes('table') && message.includes('notifications'))
  );
}

function missingColumnFromError(error: NotificationError) {
  const message = error.message;
  const quotedColumn = message.match(/'([^']+)' column/i)?.[1];
  if (quotedColumn) return quotedColumn;

  const relationColumn = message.match(/column\s+(?:public\.)?notifications\.([a-zA-Z0-9_]+)\s+does not exist/i)?.[1];
  if (relationColumn) return relationColumn;

  const detailsColumn = error.details?.match(/column\s+"?([a-zA-Z0-9_]+)"?/i)?.[1];
  return detailsColumn || '';
}

export async function GET() {
  try {
    const profile = await getCurrentUserProfile();

    if (!canSubmitPullRequests(profile.role)) {
      return NextResponse.json(
        {
          ok: false,
          message: 'Access denied.',
        },
        { status: 403 }
      );
    }

    const supabase = await supabaseAdmin();

    const { data, error } = await supabase
      .from('pull_requests')
      .select(
        `
        id,
        request_number,
        status,
        requested_by,
        created_at,
        resolved_by,
        resolved_at,
        fulfilled_by,
        fulfilled_at,
        pull_request_lines (
          id,
          request_id,
          item_id,
          part_number,
          description,
          quantity,
          location,
          notes
        )
      `
      )
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json(
        {
          ok: false,
          message: error.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      requests: data ?? [],
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : 'Failed to load pull requests.',
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  let createdRequestId = '';

  try {
    const profile = await getCurrentUserProfile();

    if (!canSubmitPullRequests(profile.role)) {
      return NextResponse.json(
        {
          ok: false,
          message: 'Access denied.',
        },
        { status: 403 }
      );
    }

    const body = (await request.json()) as PullRequestInput;
    const supabase = await supabaseAdmin();
    const currentUserEmail = await getCurrentUserEmail();

    const requestNumber = clean(body.request_number);
    const requestedBy = clean(body.requested_by) || currentUserEmail || 'unknown';
    const rawLines = Array.isArray(body.lines) ? body.lines : [];
    const lines = rawLines
      .map(normalizeLine)
      .filter(
        (line) => line.quantity > 0 && (line.item_id || line.part_number || line.description)
      );

    if (!requestNumber) {
      return NextResponse.json(
        {
          ok: false,
          message: 'Request number is required.',
        },
        { status: 400 }
      );
    }

    if (lines.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          message: 'At least one valid line is required.',
        },
        { status: 400 }
      );
    }

    const { data: pullRequest, error: pullRequestError } = await supabase
      .from('pull_requests')
      .insert({
        request_number: requestNumber,
        requested_by: requestedBy,
        status: 'OPEN',
      })
      .select('id, request_number')
      .single();

    if (pullRequestError || !pullRequest) {
      return NextResponse.json(
        {
          ok: false,
          message: pullRequestError?.message || 'Failed to create pull request.',
        },
        { status: 500 }
      );
    }

    createdRequestId = pullRequest.id;

    const lineRows = lines.map((line) => ({
      request_id: pullRequest.id,
      item_id: line.item_id,
      part_number: line.part_number,
      description: line.description,
      quantity: line.quantity,
      location: line.location,
      notes: line.notes,
    }));

    const { error: lineError } = await supabase.from('pull_request_lines').insert(lineRows);

    if (lineError) {
      await supabase.from('pull_requests').delete().eq('id', pullRequest.id);

      return NextResponse.json(
        {
          ok: false,
          message: lineError.message,
        },
        { status: 500 }
      );
    }

    const notificationError = await createPullRequestNotification(
      supabase,
      pullRequest,
      requestedBy
    );

    const activity = await logActivity({
      entityType: 'pull_request',
      entityId: pullRequest.id,
      actionType: 'PULL_REQUEST_CREATED',
      title: `Pull request ${pullRequest.request_number} created`,
      details: {
        requested_by: requestedBy,
        line_count: lineRows.length,
      },
      referenceNumber: pullRequest.request_number,
      userName: requestedBy,
    });

    if (notificationError) {
      console.error('Pull request notification failed', {
        pullRequestId: pullRequest.id,
        error: notificationError.message,
      });
    }

    if (!activity.ok) {
      console.error('Pull request activity logging failed', {
        pullRequestId: pullRequest.id,
        error: 'message' in activity ? activity.message : 'Failed to write activity log.',
      });
    }

    return NextResponse.json({
      ok: true,
      message: `Pull request ${pullRequest.request_number} submitted successfully.`,
      id: pullRequest.id,
    });
  } catch (error) {
    if (createdRequestId) {
      try {
        const supabase = await supabaseAdmin();
        await supabase.from('pull_request_lines').delete().eq('request_id', createdRequestId);
        await supabase.from('pull_requests').delete().eq('id', createdRequestId);
      } catch {
        // Best effort cleanup only.
      }
    }

    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : 'Failed to submit pull request.',
      },
      { status: 500 }
    );
  }
}
