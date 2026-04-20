import { revalidatePath } from 'next/cache';
import { ModulePageShell } from '@/components/module-page-shell';
import { BomForm } from '@/components/bom/bom-form';
import type { BomPrintSaveState } from '@/components/bom/bom-form';
import { getNextBomNumber, supabaseRest } from '@/lib/supabase/rest';

type BomInsert = {
  bom_number: string;
  bom_date: string;
  status: 'Saved';
  project_job_number: string;
  ship_from: string;
  ship_to: string;
  po_number: string;
  reference_number: string;
  requested_by: string;
  notes: string;
  authorized_by: string;
  authorized_date: string | null;
};

type BomLineInsert = {
  bom_id: string;
  part_number: string;
  description: string;
  qty: number | null;
  unit: string;
  line_number: number;
};

type ParsedLine = {
  item?: string;
  part_number?: string;
  description?: string;
  qty?: string;
  unit?: string;
};

type PreparedLine = BomLineInsert & {
  hasContent: boolean;
};

type ExistingBomShipTo = {
  ship_to: string | null;
};

function asString(value: FormDataEntryValue | null): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeAddress(value: string) {
  return value
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n')
    .trim();
}

function parseLineQty(value: string, lineNumber: number, errors: string[]) {
  const trimmed = value?.trim() ?? '';
  if (!trimmed) return null;

  const numeric = Number(trimmed);
  if (Number.isFinite(numeric)) return numeric;

  errors.push(`Line ${lineNumber}: Qty must be a number.`);
  return null;
}

function parseLinePayload(value: string): ParsedLine[] {
  if (!value) return [];

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function validateDate(value: string, errors: string[]) {
  if (!value) {
    errors.push('Choose a BOM date.');
    return;
  }

  const timestamp = Date.parse(`${value}T00:00:00`);
  if (Number.isNaN(timestamp)) {
    errors.push('Choose a valid BOM date.');
  }
}

function databaseErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : 'Unknown database error.';

  if (message.includes('duplicate key') || message.includes('23505')) {
    return 'That BOM number already exists. Use a different number or leave it blank to auto-generate one.';
  }

  return message;
}

function isMissingStatusColumn(error: unknown) {
  const message = error instanceof Error ? error.message : '';
  return (
    message.includes('column boms.status does not exist') ||
    (message.includes("Could not find") && message.includes("'status'") && message.includes("'boms'")) ||
    (message.includes('PGRST204') && message.includes('status') && message.includes('boms'))
  );
}

async function insertBomHeader(payload: BomInsert) {
  try {
    const [insertedBom] = await supabaseRest<{ id: string }[]>('boms', {
      method: 'POST',
      body: payload,
      prefer: 'return=representation',
    });

    return { insertedBom, supportsStatus: true };
  } catch (error) {
    if (!isMissingStatusColumn(error)) {
      throw error;
    }

    const { status: _status, ...payloadWithoutStatus } = payload;
    const [insertedBom] = await supabaseRest<{ id: string }[]>('boms', {
      method: 'POST',
      body: payloadWithoutStatus,
      prefer: 'return=representation',
    });

    return { insertedBom, supportsStatus: false };
  }
}

async function getSavedShipToAddresses() {
  const rows = await supabaseRest<ExistingBomShipTo[]>('boms', {
    params: {
      select: 'ship_to',
      order: 'created_at.desc',
      limit: 200,
    },
  });

  const unique = new Set<string>();

  for (const row of rows) {
    const normalized = normalizeAddress(row.ship_to || '');
    if (normalized) {
      unique.add(normalized);
    }
  }

  return Array.from(unique);
}

export default async function NewBomPage() {
  const defaultBomNumber = await getNextBomNumber();
  const defaultDate = new Date().toISOString().slice(0, 10);
  const savedShipToAddresses = await getSavedShipToAddresses();

  async function printAndSaveBom(
    _state: BomPrintSaveState,
    formData: FormData
  ): Promise<BomPrintSaveState> {
    'use server';

    const bomNumber = asString(formData.get('bom_number')) || (await getNextBomNumber());
    const bomDate = asString(formData.get('date'));
    const shipFrom = normalizeAddress(asString(formData.get('ship_from')));
    const shipTo = normalizeAddress(asString(formData.get('ship_to')));
    const validationErrors: string[] = [];

    validateDate(bomDate, validationErrors);

    if (!shipFrom) {
      validationErrors.push('Enter the Ship From details.');
    }

    const bomPayload: BomInsert = {
      bom_number: bomNumber,
      bom_date: bomDate,
      status: 'Saved',
      project_job_number: asString(formData.get('project_job')),
      ship_from: shipFrom,
      ship_to: shipTo,
      po_number: asString(formData.get('po_number')),
      reference_number: asString(formData.get('reference_number')),
      requested_by: asString(formData.get('requested_by')),
      notes: asString(formData.get('notes')),
      authorized_by: asString(formData.get('authorized_by')),
      authorized_date: asString(formData.get('authorized_date')) || null,
    };

    const parsedLines = parseLinePayload(asString(formData.get('lines_payload')));

    const preparedLines: PreparedLine[] = parsedLines
      .map((line, idx) => {
        const lineNumber = idx + 1;
        const partNumber = line.part_number?.trim() ?? '';
        const description = line.description?.trim() ?? '';
        const qtyInput = line.qty?.trim() ?? '';
        const unit = line.unit?.trim() ?? '';
        const parsedQty = parseLineQty(qtyInput, lineNumber, validationErrors);
        const hasContent = Boolean(partNumber || description || qtyInput);

        return {
          bom_id: '',
          line_number: lineNumber,
          part_number: partNumber,
          description,
          qty: parsedQty,
          unit,
          hasContent,
        };
      })
      .filter((line) => line.hasContent);

    if (preparedLines.length === 0) {
      validationErrors.push('Add at least one material line before printing.');
    }

    if (validationErrors.length > 0) {
      return {
        ok: false,
        message: 'BOM was not saved. Fix the validation items and try again.',
        errors: validationErrors,
      };
    }

    let insertedBom: { id: string } | undefined;
    let supportsStatus = true;

    try {
      const result = await insertBomHeader(bomPayload);
      insertedBom = result.insertedBom;
      supportsStatus = result.supportsStatus;
    } catch (error) {
      return {
        ok: false,
        message: 'BOM could not be saved.',
        errors: [databaseErrorMessage(error)],
      };
    }

    if (!insertedBom?.id) {
      return {
        ok: false,
        message: 'BOM could not be saved.',
        errors: ['The database did not return a saved BOM record.'],
      };
    }

    const lines: BomLineInsert[] = preparedLines.map(({ hasContent: _hasContent, ...line }) => ({
      ...line,
      bom_id: insertedBom.id,
    }));

    if (lines.length > 0) {
      try {
        await supabaseRest('bom_lines', {
          method: 'POST',
          body: lines,
          prefer: 'return=minimal',
        });
      } catch (error) {
        return {
          ok: false,
          message: 'BOM header was saved, but the line items could not be saved.',
          errors: [databaseErrorMessage(error)],
          redirectTo: `/bom/${insertedBom.id}`,
        };
      }
    }

    if (supportsStatus) {
      try {
        await supabaseRest('boms', {
          method: 'PATCH',
          params: { id: `eq.${insertedBom.id}` },
          body: { status: 'Printed' },
          prefer: 'return=minimal',
        });
      } catch (error) {
        if (!isMissingStatusColumn(error)) {
          return {
            ok: false,
            message: 'BOM was saved, but it could not be marked ready for print.',
            errors: [databaseErrorMessage(error)],
            redirectTo: `/bom/${insertedBom.id}`,
          };
        }
      }
    }

    revalidatePath('/delivery');
    revalidatePath('/bom');
    revalidatePath('/bom/new');
    revalidatePath(`/bom/${insertedBom.id}`);

    return {
      ok: true,
      message: `BOM ${bomNumber} saved. Opening print view...`,
      redirectTo: `/bom/${insertedBom.id}?print=1`,
    };
  }

  return (
    <ModulePageShell
      title="Create BOM / Release"
      subtitle="Capture header details and material line items for print-ready output"
    >
      <BomForm
        action={printAndSaveBom}
        defaultBomNumber={defaultBomNumber}
        defaultDate={defaultDate}
        savedShipToAddresses={savedShipToAddresses}
      />
    </ModulePageShell>
  );
}