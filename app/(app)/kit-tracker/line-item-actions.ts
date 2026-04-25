'use server';

import { revalidatePath } from 'next/cache';
import { supabaseAdmin } from '@/lib/supabase/admin';
import type { ImportActionResult, ImportSummary } from '@/lib/import-workflow/types';
import {
  buildKitLinePreview,
  buildKitLineSourceKey,
  isBlankKitLine,
  toKitLinePayload,
  validateKitLineUsability,
} from './kit-line-import';
import type {
  KitLineImportInput,
  KitLineImportResult,
} from './line-item-types';

async function getExistingSourceKeys(rows: KitLineImportInput[]) {
  const sourceKeys = Array.from(
    new Set(
      rows
        .filter((row) => !isBlankKitLine(row) && !validateKitLineUsability(row))
        .map(buildKitLineSourceKey)
        .filter(Boolean)
    )
  );

  if (sourceKeys.length === 0) return new Set<string>();

  const supabase = await supabaseAdmin();

  const { data, error } = await supabase
    .from('kit_line_items')
    .select('source_key')
    .in('source_key', sourceKeys);

  if (error) {
    throw new Error(error.message);
  }

  return new Set((data ?? []).map((row) => row.source_key as string));
}

function toLegacySummary(summary: ImportSummary, skipReasons: string[] = []) {
  return {
    inserted: summary.newRecords,
    updated: summary.updates,
    incompleteUsable: summary.incompleteUsable,
    skippedBlank: summary.skippedBlank,
    skippedInvalid: summary.skippedInvalid,
    skipReasons,
  };
}

export async function previewKitLineItemsImport(
  rows: KitLineImportInput[]
): Promise<ImportActionResult<KitLineImportInput>> {
  try {
    if (rows.length === 0) {
      return { ok: false, message: 'No readiness rows were found.' };
    }

    if (rows.length > 1000) {
      return { ok: false, message: 'Import is limited to 1000 readiness rows at a time.' };
    }

    const existingSourceKeys = await getExistingSourceKeys(rows);
    const preview = buildKitLinePreview(rows, existingSourceKeys);
    const saveableRows = preview.rows.filter((row) => row.status !== 'skipped').length;

    if (saveableRows === 0) {
      return {
        ok: false,
        message: `No usable readiness rows found. Skipped ${preview.summary.skippedBlank} blank and ${preview.summary.skippedInvalid} invalid.`,
        preview,
        summary: preview.summary,
      };
    }

    return {
      ok: true,
      message: `Ready to review ${saveableRows} readiness row(s).`,
      preview,
      summary: preview.summary,
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : 'Failed to preview readiness rows.',
    };
  }
}

export async function importKitLineItems(
  rows: KitLineImportInput[]
): Promise<KitLineImportResult> {
  try {
    if (rows.length === 0) {
      return { ok: false, message: 'No readiness rows were found.' };
    }

    if (rows.length > 1000) {
      return { ok: false, message: 'Import is limited to 1000 readiness rows at a time.' };
    }

    const existingSourceKeys = await getExistingSourceKeys(rows);
    const preview = buildKitLinePreview(rows, existingSourceKeys);

    const rowsToSave = preview.rows
      .filter((row) => row.status !== 'skipped')
      .map((row) => row.record);

    if (rowsToSave.length === 0) {
      return {
        ok: false,
        message: `No usable readiness rows to import. Skipped ${preview.summary.skippedBlank} blank and ${preview.summary.skippedInvalid} invalid.`,
        summary: toLegacySummary(
          preview.summary,
          preview.skipReasons.map((r) => `Row ${r.rowNumber}: ${r.reason}`).slice(0, 5)
        ),
      };
    }

    const supabase = await supabaseAdmin();

    const { error } = await supabase
      .from('kit_line_items')
      .upsert(rowsToSave.map(toKitLinePayload), { onConflict: 'source_key' });

    if (error) {
      return {
        ok: false,
        message: error.message,
        summary: toLegacySummary(preview.summary),
      };
    }

    revalidatePath('/kit-tracker');
    revalidatePath('/project-dashboard');
    revalidatePath('/executive-dashboard');

    return {
      ok: true,
      message: `Readiness import complete. ${preview.summary.newRecords} new, ${preview.summary.updates} updated, ${preview.summary.incompleteUsable} incomplete usable, ${preview.summary.skippedBlank + preview.summary.skippedInvalid} skipped.`,
      summary: toLegacySummary(
        preview.summary,
        preview.skipReasons.map((r) => `Row ${r.rowNumber}: ${r.reason}`).slice(0, 5)
      ),
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : 'Failed to import readiness rows.',
    };
  }
}

function normalizeManualLine(input: KitLineImportInput) {
  return {
    ...input,
    kit_name: input.kit_name ?? '',
    part_number: input.part_number ?? '',
    description: input.description ?? '',
    rack_type: input.rack_type ?? '',
    vendor: input.vendor ?? '',
    status: input.status ?? '',
    eta_if_not_included: input.eta_if_not_included ?? '',
    order_reference: input.order_reference ?? '',
    notes: input.notes ?? '',
    risk: input.risk ?? '',
    build_status: input.build_status ?? '',
    blocked_reason: input.blocked_reason ?? '',
  };
}

export async function createKitLineItem(
  input: KitLineImportInput
): Promise<KitLineImportResult> {
  try {
    const normalized = normalizeManualLine(input);

    if (isBlankKitLine(normalized)) {
      return { ok: false, message: 'Readiness line is blank.' };
    }

    const invalidReason = validateKitLineUsability(normalized);
    if (invalidReason) {
      return { ok: false, message: invalidReason };
    }

    const supabase = await supabaseAdmin();

    const { error } = await supabase
      .from('kit_line_items')
      .upsert(toKitLinePayload(normalized), { onConflict: 'source_key' });

    if (error) {
      return { ok: false, message: error.message };
    }

    revalidatePath('/kit-tracker');
    revalidatePath('/project-dashboard');
    revalidatePath('/executive-dashboard');

    return { ok: true, message: 'Readiness line added.' };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : 'Failed to add readiness line.',
    };
  }
}

export async function updateKitLineItem(
  id: string,
  input: KitLineImportInput
): Promise<KitLineImportResult> {
  try {
    const normalized = normalizeManualLine(input);

    if (!id) {
      return { ok: false, message: 'Readiness line ID is required.' };
    }

    if (isBlankKitLine(normalized)) {
      return { ok: false, message: 'Readiness line is blank.' };
    }

    const invalidReason = validateKitLineUsability(normalized);
    if (invalidReason) {
      return { ok: false, message: invalidReason };
    }

    const supabase = await supabaseAdmin();

    const { error } = await supabase
      .from('kit_line_items')
      .update(toKitLinePayload(normalized))
      .eq('id', id);

    if (error) {
      return { ok: false, message: error.message };
    }

    revalidatePath('/kit-tracker');
    revalidatePath('/project-dashboard');
    revalidatePath('/executive-dashboard');

    return { ok: true, message: 'Readiness line updated.' };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : 'Failed to update readiness line.',
    };
  }
}