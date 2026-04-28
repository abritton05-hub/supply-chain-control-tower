import { NextResponse } from 'next/server';
import { logActivity } from '@/lib/activity/log-activity';
import { getCurrentUserProfile } from '@/lib/auth/profile';

export const runtime = 'nodejs';

type ActivityBody = {
  action_type?: string;
  module?: string;
  record_id?: string;
  record_label?: string;
  reference_number?: string;
  notes?: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  details?: Record<string, unknown> | null;
};

function clean(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

export async function POST(request: Request) {
  try {
    const profile = await getCurrentUserProfile();

    if (!profile.is_active) {
      return NextResponse.json({ ok: false, message: 'Access denied.' }, { status: 403 });
    }

    const body = (await request.json()) as ActivityBody;
    const actionType = clean(body.action_type);

    if (!actionType) {
      return NextResponse.json({ ok: false, message: 'action_type is required.' }, { status: 400 });
    }

    const result = await logActivity({
      actionType,
      module: clean(body.module) || 'general',
      recordId: clean(body.record_id) || null,
      recordLabel: clean(body.record_label) || null,
      referenceNumber: clean(body.reference_number) || null,
      notes: clean(body.notes) || null,
      actor: profile.email || profile.full_name || 'unknown',
      before: body.before ?? null,
      after: body.after ?? null,
      details: body.details ?? null,
    });

    if (!result.ok) {
      console.warn('Activity logging failed.', { actionType, message: result.message });
      return NextResponse.json({ ok: true, warning: result.message });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : 'Activity logging failed.' },
      { status: 500 }
    );
  }
}
