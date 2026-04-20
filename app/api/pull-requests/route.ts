import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { logActivity } from '@/lib/activity/log-activity';

type IncomingLine = {
  item_id: string;
  part_number?: string;
  description?: string;
  quantity: number;
  location?: string;
  notes?: string;
};

export async function GET() {
  try {
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
      return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
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

export async function POST(req: Request) {
  try {
    const supabase = await supabaseServer();
    const body = await req.json();

    const requestNumber =
      typeof body.request_number === 'string' && body.request_number.trim()
        ? body.request_number.trim()
        : `PR-${Date.now()}`;

    const requestedBy =
      typeof body.requested_by === 'string' && body.requested_by.trim()
        ? body.requested_by.trim()
        : 'TECH';

    const lines = Array.isArray(body.lines) ? (body.lines as IncomingLine[]) : [];

    if (lines.length === 0) {
      return NextResponse.json(
        { ok: false, message: 'Add at least one line before submitting.' },
        { status: 400 }
      );
    }

    for (const line of lines) {
      const qty = Number(line.quantity ?? 0);

      if (!line.item_id?.trim()) {
        return NextResponse.json(
          { ok: false, message: 'One or more request lines are missing item_id.' },
          { status: 400 }
        );
      }

      if (!Number.isFinite(qty) || qty <= 0) {
        return NextResponse.json(
          { ok: false, message: `Invalid quantity for ${line.part_number || line.item_id}.` },
          { status: 400 }
        );
      }
    }

    const { data: insertedRequest, error: requestError } = await supabase
      .from('pull_requests')
      .insert({
        request_number: requestNumber,
        status: 'OPEN',
        requested_by: requestedBy,
      })
      .select('id,request_number')
      .single();

    if (requestError || !insertedRequest) {
      return NextResponse.json(
        { ok: false, message: requestError?.message || 'Failed to create pull request.' },
        { status: 500 }
      );
    }

    const lineRows = lines.map((line) => ({
      request_id: insertedRequest.id,
      item_id: line.item_id.trim(),
      part_number: line.part_number?.trim() || null,
      description: line.description?.trim() || null,
      quantity: Number(line.quantity),
      location: line.location?.trim() || null,
      notes: line.notes?.trim() || null,
    }));

    const { error: linesError } = await supabase.from('pull_request_lines').insert(lineRows);

    if (linesError) {
      return NextResponse.json(
        {
          ok: false,
          message: `Pull request header was created, but lines failed: ${linesError.message}`,
        },
        { status: 500 }
      );
    }

    const { error: notificationError } = await supabase.from('notifications').insert({
      type: 'PULL_REQUEST',
      reference_id: insertedRequest.id,
      message: `New pull request ${insertedRequest.request_number}`,
      is_read: false,
    });

    if (notificationError) {
      return NextResponse.json(
        {
          ok: false,
          message: `Pull request saved, but notification failed: ${notificationError.message}`,
        },
        { status: 500 }
      );
    }

    const activity = await logActivity({
      entityType: 'pull_request',
      entityId: insertedRequest.id,
      actionType: 'PULL_REQUEST_CREATED',
      title: `Pull request ${insertedRequest.request_number} created`,
      details: {
        requested_by: requestedBy,
        line_count: lines.length,
        lines: lineRows,
      },
      referenceNumber: insertedRequest.request_number,
      userName: requestedBy,
    });

    if (!activity.ok) {
      return NextResponse.json(
        {
          ok: false,
          message: `Pull request saved, but activity log failed: ${activity.message}`,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      requestId: insertedRequest.id,
      requestNumber: insertedRequest.request_number,
      message: `Pull request ${insertedRequest.request_number} submitted.`,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : 'Failed to submit pull request.',
      },
      { status: 500 }
    );
  }
}