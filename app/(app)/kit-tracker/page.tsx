import { KpiCard } from '@/components/kpi-card';
import { SectionHeader } from '@/components/section-header';
import { supabaseServer } from '@/lib/supabase/server';
import { KitTrackerClient } from './kit-tracker-client';
import type { KitRecord } from './types';

export default async function KitTrackerPage() {
  const supabase = await supabaseServer();

  const { data, error } = await supabase
    .from('kits')
    .select(
      'id,kit_number,kit_name,project_name,location,status,block_reason,completed_date,delivery_requested,delivery_requested_date,delivery_scheduled_date,notes,created_at,updated_at'
    )
    .order('created_at', { ascending: false });

  const kits = (data ?? []) as KitRecord[];
  const blocked = kits.filter((kit) => kit.status === 'Blocked').length;
  const ready = kits.filter((kit) => kit.status === 'Ready').length;
  const deliveryQueue = kits.filter(
    (kit) =>
      kit.delivery_requested ||
      kit.status === 'Delivery Requested' ||
      kit.status === 'Delivery Scheduled'
  ).length;
  const delivered = kits.filter((kit) => kit.status === 'Delivered').length;

  return (
    <div className="space-y-4">
      <SectionHeader
        title="Kit Tracker"
        subtitle="Operational center for kit readiness, blockers, completion, and delivery handoff"
      />

      <div className="grid gap-3 md:grid-cols-4">
        <KpiCard label="Total Kits" value={kits.length} />
        <KpiCard label="Blocked" value={blocked} />
        <KpiCard label="Ready" value={ready} />
        <KpiCard label="Delivery Queue" value={deliveryQueue} />
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <KpiCard label="Delivered" value={delivered} />
        <KpiCard
          label="Open Work"
          value={kits.filter((kit) => kit.status !== 'Delivered').length}
        />
        <KpiCard
          label="Needs Attention"
          value={kits.filter((kit) => kit.status === 'Blocked' || kit.block_reason).length}
        />
      </div>

      {error ? (
        <div className="erp-panel border-rose-200 bg-rose-50 p-5">
          <h2 className="text-base font-semibold text-rose-800">Kits table is not ready</h2>
          <p className="mt-2 text-sm leading-6 text-rose-700">
            Supabase returned: {error.message}. Create the `kits` table using
            `docs/supabase-kit-tracker.sql`, then reload this page.
          </p>
        </div>
      ) : (
        <KitTrackerClient kits={kits} />
      )}
    </div>
  );
}
