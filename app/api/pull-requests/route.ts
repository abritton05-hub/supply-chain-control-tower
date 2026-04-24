import { NextResponse } from 'next/server';
import { getCurrentUserProfile } from '@/lib/auth/profile';
import { canSubmitPullRequests } from '@/lib/auth/roles';
import { getCurrentUserEmail } from '@/lib/auth/session';
import { logActivity } from '@/lib/activity/log-activity';
import { supabaseServer } from '@/lib/supabase/server';

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

    const supabase = await supabaseServer();

    const { data, error } = await supabase
      .from('pull_requests')
      .select(
        `
        id,
        request_number,
        status,
        requested_by,
        created_at,
        pull_request_lines (
          id,
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
        message:
          error instanceof Error ? error.message : 'Failed to load pull requests.',
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
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
    const supabase = await supabaseServer();
    const currentUserEmail = await getCurrentUserEmail();

    const requestNumber = clean(body.request_number);
    const requestedBy = clean(body.requested_by) || currentUserEmail || 'unknown';
    const rawLines = Array.isArray(body.lines) ? body.lines : [];
    const lines = rawLines
      .map(normalizeLine)
      .filter(
        (line) =>
          line.quantity > 0 &&
          (line.item_id || line.part_number || line.description)
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

    const lineRows = lines.map((line) => ({
      pull_request_id: pullRequest.id,
      item_id: line.item_id,
      part_number: line.part_number,
      description: line.description,
      quantity: line.quantity,
      location: line.location,
      notes: line.notes,
    }));

    const { error: lineError } = await supabase
      .from('pull_request_lines')
      .insert(lineRows);

    if (lineError) {
      return NextResponse.json(
        {
          ok: false,
          message: lineError.message,
        },
        { status: 500 }
      );
    }

    await logActivity({
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

    return NextResponse.json({
      ok: true,
      message: `Pull request ${pullRequest.request_number} submitted successfully.`,
      id: pullRequest.id,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error ? error.message : 'Failed to submit pull request.',
      },
      { status: 500 }
    );
  }
}