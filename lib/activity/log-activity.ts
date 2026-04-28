'use server';

import { getCurrentUserEmail } from '@/lib/auth/session';
import { supabaseServer } from '@/lib/supabase/server';

export type ActivityLogInput = {
  actionType: string;
  module?: string | null;
  entityType?: string | null;
  recordId?: string | null;
  entityId?: string | null;
  recordLabel?: string | null;
  title?: string | null;
  details?: Record<string, unknown> | null;
  referenceNumber?: string | null;
  actor?: string | null;
  userName?: string | null;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  notes?: string | null;
};

export type ActivityLogResult =
  | { ok: true }
  | { ok: false; message: string };

function clean(value: string | null | undefined) {
  return value?.trim() || null;
}

function buildTitle(input: ActivityLogInput) {
  const explicitTitle = clean(input.title);
  if (explicitTitle) return explicitTitle;

  const label = clean(input.recordLabel);
  const action = clean(input.actionType) || 'ACTIVITY';
  return label ? `${action} ${label}` : action;
}

export async function logActivity(input: ActivityLogInput): Promise<ActivityLogResult> {
  try {
    const supabase = await supabaseServer();
    const currentUserEmail = await getCurrentUserEmail();
    const actor =
      clean(input.actor) ?? clean(input.userName) ?? currentUserEmail ?? 'unknown';

    const recordId = clean(input.recordId) ?? clean(input.entityId);
    const moduleName = clean(input.module) ?? clean(input.entityType) ?? 'general';

    const { error } = await supabase.from('activity_log').insert({
      entity_type: moduleName,
      entity_id: recordId,
      action_type: (clean(input.actionType) || 'ACTIVITY') as string,
      title: buildTitle(input),
      details: {
        module: moduleName,
        record_id: recordId,
        record_label: clean(input.recordLabel),
        actor,
        notes: clean(input.notes),
        before: input.before ?? null,
        after: input.after ?? null,
        ...(input.details ?? {}),
      },
      reference_number: clean(input.referenceNumber),
      user_name: actor,
    });

    if (error) {
      return { ok: false, message: error.message };
    }

    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : 'Failed to write activity log.',
    };
  }
}
