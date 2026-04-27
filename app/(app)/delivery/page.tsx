import { redirect } from 'next/navigation';
import { ModulePageShell } from '@/components/module-page-shell';
import { getCurrentUserProfile } from '@/lib/auth/profile';
import { canManageDelivery } from '@/lib/auth/roles';
import { supabaseRest } from '@/lib/supabase/rest';
import { DeliveryClient } from './delivery-client';
import type {
  BomHeader,
  DeliveryPageData,
  DeliveryView,
  HistoryRecord,
  ManifestHeader,
} from './types';

function activeView(value?: string | string[]): DeliveryView {
  const view = Array.isArray(value) ? value[0] : value;

  if (
    view === 'manifest' ||
    view === 'pickups' ||
    view === 'deliveries' ||
    view === 'history'
  ) {
    return view;
  }

  return 'bom';
}

function isMissingStatusColumn(error: unknown) {
  const message = error instanceof Error ? error.message : '';
  return (
    message.includes('column boms.status does not exist') ||
    (message.includes('Could not find') && message.includes("'status'") && message.includes("'boms'")) ||
    (message.includes('PGRST204') && message.includes('status') && message.includes('boms'))
  );
}

function directionLabel(direction: string | null) {
  if (direction === 'incoming') return 'Incoming';
  if (direction === 'outgoing') return 'Outgoing';
  return '-';
}

function sortDate(value: string | null) {
  if (!value) return 0;
  const timestamp = Date.parse(`${value}T00:00:00`);
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

async function getBoms() {
  try {
    return await supabaseRest<BomHeader[]>('boms', {
      params: {
        select: 'id,bom_number,bom_date,status,project_job_number,requested_by',
        order: 'bom_date.desc.nullslast,created_at.desc',
        limit: 200,
      },
    });
  } catch (error) {
    if (!isMissingStatusColumn(error)) throw error;

    const boms = await supabaseRest<Omit<BomHeader, 'status'>[]>('boms', {
      params: {
        select: 'id,bom_number,bom_date,project_job_number,requested_by',
        order: 'bom_date.desc.nullslast,created_at.desc',
        limit: 200,
      },
    });

    return boms.map((bom) => ({ ...bom, status: null }));
  }
}

async function getManifests() {
  return supabaseRest<ManifestHeader[]>('manifests', {
    params: {
      select:
        'id,manifest_number,document_title,manifest_date,manifest_time,direction,status,shipment_transfer_id,driver_carrier,reference_project_work_order',
      order: 'manifest_date.desc.nullslast,created_at.desc',
      limit: 200,
    },
  });
}

function toHistory(boms: BomHeader[], manifests: ManifestHeader[]): HistoryRecord[] {
  const bomRecords: HistoryRecord[] = boms.map((bom) => ({
    id: `bom-${bom.id}`,
    type: 'BOM / Release',
    number: bom.bom_number || '(Auto-numbered)',
    title: bom.project_job_number || 'Release record',
    date: bom.bom_date,
    status: bom.status || 'Saved',
    direction: 'Release',
    reference: bom.requested_by || '-',
    href: `/bom/${bom.id}`,
  }));

  const manifestRecords: HistoryRecord[] = manifests.map((manifest) => ({
    id: `manifest-${manifest.id}`,
    type: 'Manifest',
    number: manifest.manifest_number || '(Auto-numbered)',
    title: manifest.document_title || 'Material Manifest',
    date: manifest.manifest_date,
    status: manifest.status || 'Draft',
    direction: directionLabel(manifest.direction),
    reference: manifest.reference_project_work_order || manifest.shipment_transfer_id || '-',
    href: `/driver-manifest/${manifest.id}`,
  }));

  return [...bomRecords, ...manifestRecords].sort((a, b) => sortDate(b.date) - sortDate(a.date));
}

async function getDeliveryData(view: DeliveryView): Promise<DeliveryPageData> {
  let boms: BomHeader[] = [];
  let manifests: ManifestHeader[] = [];
  let bomError = '';
  let manifestError = '';

  try {
    boms = await getBoms();
  } catch (error) {
    bomError = error instanceof Error ? error.message : 'BOM data could not be loaded.';
  }

  try {
    manifests = await getManifests();
  } catch (error) {
    manifestError = error instanceof Error ? error.message : 'Manifest data could not be loaded.';
  }

  const pickups = manifests.filter((manifest) => manifest.direction === 'incoming');
  const deliveries = manifests.filter((manifest) => manifest.direction === 'outgoing');
  const history = toHistory(boms, manifests);

  return {
    view,
    boms,
    manifests,
    pickups,
    deliveries,
    history,
    bomError,
    manifestError,
  };
}

export default async function DeliveryPage({
  searchParams,
}: {
  searchParams?: { view?: string | string[] };
}) {
  const profile = await getCurrentUserProfile();

  if (!canManageDelivery(profile.role)) {
    redirect('/inventory');
  }

  const view = activeView(searchParams?.view);
  const data = await getDeliveryData(view);

  return (
    <ModulePageShell
      title="Shipping"
      subtitle="BOM releases, manifests, pickups, deliveries, and saved movement history"
    >
      <DeliveryClient {...data} canManageDelivery={canManageDelivery(profile.role)} />
    </ModulePageShell>
  );
}
