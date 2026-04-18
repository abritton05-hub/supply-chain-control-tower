import { redirect } from 'next/navigation';
import { ModulePageShell } from '@/components/module-page-shell';
import { BomForm } from '@/components/bom/bom-form';
import { getNextBomNumber, supabaseRest } from '@/lib/supabase/rest';

type BomInsert = {
  bom_number: string;
  bom_date: string;
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
  item: string;
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

function asString(value: FormDataEntryValue | null): string {
  return typeof value === 'string' ? value.trim() : '';
}

function parseLineQty(value?: string) {
  const trimmed = value?.trim() ?? '';
  if (!trimmed) return null;

  const numeric = Number(trimmed);
  return Number.isFinite(numeric) ? numeric : null;
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

export default async function NewBomPage() {
  const defaultBomNumber = await getNextBomNumber();
  const defaultDate = new Date().toISOString().slice(0, 10);

  async function createBom(formData: FormData) {
    'use server';

    const bomNumber = asString(formData.get('bom_number')) || (await getNextBomNumber());

    const bomPayload: BomInsert = {
      bom_number: bomNumber,
      bom_date: asString(formData.get('date')),
      project_job_number: asString(formData.get('project_job')),
      ship_from: asString(formData.get('ship_from')),
      ship_to: asString(formData.get('ship_to')),
      po_number: asString(formData.get('po_number')),
      reference_number: asString(formData.get('reference_number')),
      requested_by: asString(formData.get('requested_by')),
      notes: asString(formData.get('notes')),
      authorized_by: asString(formData.get('authorized_by')),
      authorized_date: asString(formData.get('authorized_date')) || null,
    };

    const [insertedBom] = await supabaseRest<{ id: string }[]>('boms', {
      method: 'POST',
      body: bomPayload,
      prefer: 'return=representation',
    });

    const parsedLines = parseLinePayload(asString(formData.get('lines_payload')));

    const lines: BomLineInsert[] = parsedLines
      .map((line, idx) => {
        const parsedQty = parseLineQty(line.qty);

        return {
          bom_id: insertedBom.id,
          line_number: idx + 1,
          item: line.item?.trim() ?? '',
          part_number: line.part_number?.trim() ?? '',
          description: line.description?.trim() ?? '',
          qty: parsedQty,
          unit: line.unit?.trim() ?? '',
        };
      })
      .filter((line) => line.item || line.part_number || line.description || line.qty !== null);

    if (lines.length > 0) {
      await supabaseRest('bom_lines', {
        method: 'POST',
        body: lines,
        prefer: 'return=minimal',
      });
    }

    redirect(`/bom/${insertedBom.id}`);
  }

  return (
    <ModulePageShell title="Create BOM" subtitle="Capture header details and material line items for print-ready output">
      <BomForm action={createBom} defaultBomNumber={defaultBomNumber} defaultDate={defaultDate} />
    </ModulePageShell>
  );
}
