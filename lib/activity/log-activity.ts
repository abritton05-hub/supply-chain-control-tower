'use server';

import { getCurrentUserEmail } from '@/lib/auth/session';
import { supabaseAdmin } from '@/lib/supabase/admin';

export type ActivityLogInput = {
  entityType: string;
  entityId?: string | null;
  actionType: string;
  title: string;
  details?: Record<string, unknown> | null;
  referenceNumber?: string | null;
  userName?: string | null;
};

export type ActivityLogResult =
  | { ok: true }
  | { ok: false; message: string };

function clean(value: string | null | undefined) {
  return value?.trim() || null;
}

function normalizeErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Failed to write activity log.';
}

function missingColumnFromMessage(message: string) {
  const patterns = [
    /column\s+activity_log\.([a-z0-9_]+)\s+does not exist/i,
    /Could not find the '([a-z0-9_]+)' column of 'activity_log'/i,
    /schema cache.*'activity_log'.*'([a-z0-9_]+)'/i,
  ];

  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match?.[1]) {
      return match[1];
    }
  }

  return '';
}

async function safeCurrentUserEmail() {
  try {
    return await getCurrentUserEmail();
  } catch (error) {
    console.error('Activity log: could not resolve current user email.', error);
    return null;
  }
}

async function insertActivityPayload(
  supabase: Awaited<ReturnType<typeof supabaseAdmin>>,
  payload: Record<string, unknown>
) {
  const nextPayload = { ...payload };
  const removableColumns = new Set(Object.keys(nextPayload));

  while (true) {
    const { error } = await supabase.from('activity_log').insert(nextPayload);

    if (!error) {
      return { ok: true as const };
    }

    const errorMessage = normalizeErrorMessage(error);
    const missingColumn = missingColumnFromMessage(errorMessage);

    if (!missingColumn || !removableColumns.has(missingColumn)) {
      return { ok: false as const, message: errorMessage };
    }

    delete nextPayload[missingColumn];
    removableColumns.delete(missingColumn);

    console.error(
      `Activity log: retrying insert without missing column "${missingColumn}".`,
      error
    );

    if (!Object.keys(nextPayload).length) {
      return {
        ok: false as const,
        message: 'Activity log payload had no supported columns to insert.',
      };
    }
  }
}

export async function logActivity(input: ActivityLogInput): Promise<ActivityLogResult> {
  try {
    const supabase = await supabaseAdmin();
    const currentUserEmail = await safeCurrentUserEmail();
    const userName = clean(input.userName) ?? currentUserEmail ?? 'unknown';

    const payload = {
      entity_type: input.entityType.trim(),
      entity_id: clean(input.entityId),
      action_type: input.actionType.trim(),
      title: input.title.trim(),
      details: input.details ?? null,
      reference_number: clean(input.referenceNumber),
      user_name: userName,
    };

    const result = await insertActivityPayload(supabase, payload);

    if (!result.ok) {
      console.error('Activity log insert failed.', {
        entityType: payload.entity_type,
        entityId: payload.entity_id,
        actionType: payload.action_type,
        message: result.message,
      });
      return { ok: false, message: result.message };
    }

    return { ok: true };
  } catch (error) {
    console.error('Activity log unexpected failure.', error);
    return {
      ok: false,
      message: normalizeErrorMessage(error),
    };
  }
}
