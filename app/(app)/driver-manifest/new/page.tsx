import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { ManifestForm } from '@/components/manifest/manifest-form';
import { ModulePageShell } from '@/components/module-page-shell';
import { getNextManifestNumber, supabaseRest } from '@/lib/supabase/rest';

type ManifestInsert = {
  manifest_number: string;
  document_title: string;
  direction: string;
  manifest_date: string;
  manifest_time: string;
  status: string;
  shipment_transfer_id: string;
  driver_carrier: string;
  vehicle: string;
  reference_project_work_order: string;
  from_location: string;
  to_location: string;
  authorized_for_release_by: string;
  released_to_print_name: string;
  company: string;
  signature: string;
  id_verified_by: string;
  received_by: string;
  notes: string;
};

type ManifestLineInsert = {
  manifest_id: string;
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

export default async function NewManifestPage() {
  const defaultManifestNumber = await getNextManifestNumber();
  const now = new Date();
  const defaultDate = now.toISOString().slice(0, 10);
  const defaultTime = now.toTimeString().slice(0, 5);

  async function createManifest(formData: FormData) {
    'use server';

    const direction = asString(formData.get('direction')) === 'incoming' ? 'incoming' : 'outgoing';
    const documentTitle = direction === 'incoming' ? 'Incoming Material Manifest' : 'Outgoing Material Manifest';
    const manifestNumber = asString(formData.get('manifest_number')) || (await getNextManifestNumber());

    const manifestPayload: ManifestInsert = {
      manifest_number: manifestNumber,
      document_title: documentTitle,
      direction,
      manifest_date: asString(formData.get('date')),
      manifest_time: asString(formData.get('time')),
      status: asString(formData.get('status')) || 'Draft',
      shipment_transfer_id: asString(formData.get('shipment_transfer_id')),
      driver_carrier: asString(formData.get('driver_carrier')),
      vehicle: asString(formData.get('vehicle')),
      reference_project_work_order: asString(formData.get('reference_project_work_order')),
      from_location: asString(formData.get('from_location')),
      to_location: asString(formData.get('to_location')),
      authorized_for_release_by: asString(formData.get('authorized_for_release_by')),
      released_to_print_name: asString(formData.get('released_to_print_name')),
      company: asString(formData.get('company')),
      signature: asString(formData.get('signature')),
      id_verified_by: asString(formData.get('id_verified_by')),
      received_by: asString(formData.get('received_by')),
      notes: asString(formData.get('notes')),
    };

    const [insertedManifest] = await supabaseRest<{ id: string }[]>('manifests', {
      method: 'POST',
      body: manifestPayload,
      prefer: 'return=representation',
    });

    const parsedLines = parseLinePayload(asString(formData.get('lines_payload')));

    const lines: ManifestLineInsert[] = parsedLines
      .map((line, idx) => {
        const parsedQty = parseLineQty(line.qty);

        return {
          manifest_id: insertedManifest.id,
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
      await supabaseRest('manifest_lines', {
        method: 'POST',
        body: lines,
        prefer: 'return=minimal',
      });
    }

    revalidatePath('/delivery');
    revalidatePath('/driver-manifest');
    redirect(`/driver-manifest/${insertedManifest.id}`);
  }

  return (
    <ModulePageShell title="Create Manifest" subtitle="Capture incoming or outgoing SEA991 material transfer details for print-ready release">
      <ManifestForm action={createManifest} defaultManifestNumber={defaultManifestNumber} defaultDate={defaultDate} defaultTime={defaultTime} />
    </ModulePageShell>
  );
}
