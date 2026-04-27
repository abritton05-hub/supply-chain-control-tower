'use server';

import { revalidatePath } from 'next/cache';
import { logActivity } from '@/lib/activity/log-activity';
import { getCurrentUserProfile } from '@/lib/auth/profile';
import { canEditInventory } from '@/lib/auth/roles';
import { supabaseServer } from '@/lib/supabase/server';
import {
  BLOCK_REASONS,
  KIT_STATUSES,
  type BlockReason,
  type KitActionResult,
  type KitFormInput,
  type KitStatus,
} from './types';

function clean(value: string | null | undefined) {
  return value?.trim() ?? '';
}

function isKitStatus(value: string): value is KitStatus {
  return KIT_STATUSES.includes(value as KitStatus);
}

function isBlockReason(value: string): value is BlockReason {
  return BLOCK_REASONS.includes(value as BlockReason);
}

function optionalDate(value: string) {
  const trimmed = clean(value);
  return trimmed || null;
}

function validateKit(input: KitFormInput): KitActionResult {
  if (!clean(input.kit_number)) {
    if (clean(input.kit_name) && clean(input.project_name)) {
      return {
        ok: false,
        message: 'Kit number is required. Row had kit name and project, but no kit number.',
      };
    }

    return { ok: false, message: 'Kit number is required.' };
  }

  if (!clean(input.kit_name)) {
    return { ok: false, message: 'Kit name is required.' };
  }

  if (!isKitStatus(input.status)) {
    return { ok: false, message: 'Choose a valid kit status.' };
  }

  if (input.block_reason && !isBlockReason(input.block_reason)) {
    return { ok: false, message: 'Choose a valid block reason.' };
  }

  if (input.status === 'Blocked' && !input.block_reason) {
    return { ok: false, message: 'Blocked kits need a block reason.' };
  }

  if (input.delivery_requested && !input.delivery_requested_date) {
    return { ok: false, message: 'Delivery requested kits need a requested date.' };
  }

  return { ok: true, message: 'Valid kit.' };
}

function isBlankKit(input: KitFormInput) {
  return [
    input.kit_number,
    input.kit_name,
    input.project_name,
    input.location,
    input.block_reason,
    input.completed_date,
    input.delivery_requested_date,
    input.delivery_scheduled_date,
    input.notes,
  ].every((value) => !clean(String(value ?? ''))) &&
    input.status === 'Not Started' &&
    !input.delivery_requested;
}

function toPayload(input: KitFormInput) {
  const deliveryRequested =
    Boolean(input.delivery_requested) ||
    input.status === 'Delivery Requested' ||
    input.status === 'Delivery Scheduled' ||
    input.status === 'Delivered';

  return {
    kit_number: clean(input.kit_number),
    kit_name: clean(input.kit_name),
    project_name: clean(input.project_name) || null,
    location: clean(input.location) || null,
    status: input.status,
    block_reason: input.block_reason || null,
    completed_date: optionalDate(input.completed_date),
    delivery_requested: deliveryRequested,
    delivery_requested_date: deliveryRequested ? optionalDate(input.delivery_requested_date) : null,
    delivery_scheduled_date: optionalDate(input.delivery_scheduled_date),
    notes: clean(input.notes) || null,
  };
}

async function requireKitTrackerAccess() {
  const profile = await getCurrentUserProfile();

  if (!canEditInventory(profile.role)) {
    throw new Error('Warehouse or admin access is required to manage kits.');
  }
}

export async function createKit(input: KitFormInput): Promise<KitActionResult> {
  try {
    await requireKitTrackerAccess();

    const validation = validateKit(input);
    if (!validation.ok) return validation;

    const supabase = await supabaseServer();
    const payload = toPayload(input);

    const { data: insertedKit, error } = await supabase
      .from('kits')
      .insert(payload)
      .select('id,kit_number,kit_name,status,location,project_name')
      .single();

    if (error || !insertedKit) {
      return { ok: false, message: error?.message || 'Failed to add kit.' };
    }

    const activity = await logActivity({
      entityType: 'KIT',
      entityId: insertedKit.id,
      actionType: 'CREATE',
      title: `Created kit ${insertedKit.kit_number}`,
      details: {
        kit_number: insertedKit.kit_number,
        kit_name: insertedKit.kit_name,
        project_name: insertedKit.project_name,
        location: insertedKit.location,
        status: insertedKit.status,
      },
      referenceNumber: insertedKit.kit_number,
    });

    if (!activity.ok) {
      return {
        ok: false,
        message: 'Kit added, but activity logging failed.',
      };
    }

    revalidatePath('/kit-tracker');
    return { ok: true, message: 'Kit added.' };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : 'Failed to add kit.',
    };
  }
}

export async function updateKit(input: KitFormInput): Promise<KitActionResult> {
  try {
    await requireKitTrackerAccess();

    if (!input.id) {
      return { ok: false, message: 'Kit ID is required for edits.' };
    }

    const validation = validateKit(input);
    if (!validation.ok) return validation;

    const supabase = await supabaseServer();
    const payload = toPayload(input);

    const { error } = await supabase
      .from('kits')
      .update(payload)
      .eq('id', input.id);

    if (error) {
      return { ok: false, message: error.message };
    }

    const activity = await logActivity({
      entityType: 'KIT',
      entityId: input.id,
      actionType: 'UPDATE',
      title: `Updated kit ${payload.kit_number}`,
      details: payload,
      referenceNumber: payload.kit_number,
    });

    if (!activity.ok) {
      return {
        ok: false,
        message: 'Kit updated, but activity logging failed.',
      };
    }

    revalidatePath('/kit-tracker');
    return { ok: true, message: 'Kit updated.' };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : 'Failed to update kit.',
    };
  }
}

export async function importKits(inputs: KitFormInput[]): Promise<KitActionResult> {
  try {
    await requireKitTrackerAccess();

    if (inputs.length === 0) {
      return { ok: false, message: 'No kit rows were found in the upload.' };
    }

    if (inputs.length > 250) {
      return { ok: false, message: 'Import is limited to 250 rows at a time.' };
    }

    const validInputs: KitFormInput[] = [];
    const skipReasons: string[] = [];
    let skippedBlank = 0;
    let skippedInvalid = 0;

    for (const [index, input] of inputs.entries()) {
      const rowNumber = input.source_row_number ?? index + 2;

      if (isBlankKit(input)) {
        skippedBlank += 1;
        continue;
      }

      const validation = validateKit(input);
      if (!validation.ok) {
        skippedInvalid += 1;
        skipReasons.push(`Row ${rowNumber}: ${validation.message}`);
        continue;
      }

      validInputs.push(input);
    }

    if (validInputs.length === 0) {
      const sampleReasons = skipReasons.slice(0, 5).join(' ');
      return {
        ok: false,
        message: `No valid kit rows to import. Skipped ${skippedBlank} blank row(s) and ${skippedInvalid} invalid row(s). ${sampleReasons}`,
      };
    }

    const supabase = await supabaseServer();
    const kitNumbers = validInputs.map((input) => clean(input.kit_number));

    const { data: existingRows, error: existingError } = await supabase
      .from('kits')
      .select('kit_number')
      .in('kit_number', kitNumbers);

    if (existingError) {
      return { ok: false, message: existingError.message };
    }

    const existingKitNumbers = new Set((existingRows ?? []).map((row) => row.kit_number));
    const inserted = validInputs.filter((input) => !existingKitNumbers.has(clean(input.kit_number))).length;
    const updated = validInputs.length - inserted;

    const { error } = await supabase
      .from('kits')
      .upsert(validInputs.map(toPayload), { onConflict: 'kit_number' });

    if (error) {
      return { ok: false, message: error.message };
    }

    revalidatePath('/kit-tracker');

    const sampleReasons = skipReasons.slice(0, 5);
    const reasonText = sampleReasons.length ? ` Sample issues: ${sampleReasons.join(' ')}` : '';

    return {
      ok: true,
      message: `Inserted ${inserted}, updated ${updated}, skipped ${skippedBlank} blank and ${skippedInvalid} invalid.${reasonText}`,
      summary: {
        inserted,
        updated,
        skippedBlank,
        skippedInvalid,
        skipReasons: sampleReasons,
      },
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : 'Failed to import kits.',
    };
  }
}
