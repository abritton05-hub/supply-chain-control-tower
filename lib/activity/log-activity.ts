'use server';

import { getCurrentUserEmail } from '@/lib/auth/session';
import { supabaseServer } from '@/lib/supabase/server';

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

export async function logActivity(input: ActivityLogInput): Promise<ActivityLogResult> {
  try {
    const supabase = await supabaseServer();
    const currentUserEmail = await getCurrentUserEmail();
    const userName = clean(input.userName) ?? currentUserEmail ?? 'unknown';

    const { error } = await supabase.from('activity_log').insert({
      entity_type: input.entityType.trim(),
      entity_id: clean(input.entityId),
      action_type: input.actionType.trim(),
      title: input.title.trim(),
      details: input.details ?? null,
      reference_number: clean(input.referenceNumber),
      user_name: userName,
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