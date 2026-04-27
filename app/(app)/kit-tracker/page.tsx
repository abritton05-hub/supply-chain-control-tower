import { redirect } from 'next/navigation';
import { KpiCard } from '@/components/kpi-card';
import { SectionHeader } from '@/components/section-header';
import { getCurrentUserProfile } from '@/lib/auth/profile';
import { canEditInventory } from '@/lib/auth/roles';
import { supabaseServer } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { KitLineImportPanel } from './kit-line-import-panel';
import { KitTrackerClient } from './kit-tracker-client';
import type { KitLineRecord } from './line-item-types';
import type { KitRecord } from './types';

export default async function KitTrackerPage() {
  const profile = await getCurrentUserProfile();

  if (!canEditInventory(profile.role)) {
    redirect('/inventory');
  }

  const supabase = await supabaseServer();
  const supabasePrivileged = await supabaseAdmin();

  const { data, error } = await supabase
    .from('kits')
    .select(
      'id,kit_number,kit_name,project_name,location,status,block_reason,completed_date,delivery_requested,delivery_requested_date,delivery_scheduled_date,notes,created_at,updated_at'
    )
    .order('created_at', { ascending: false });

  const { data: lineItemData, error: lineItemError } = await supabasePrivileged
    .from('kit_line_items')
    .select(
      'id,source_key,kit_name,part_number,description,rack_type,vendor,qty_required,qty_on_hand,qty_needed,included_in_first_5_kits,status,eta_if_not_included,order_reference,notes,risk,ready_to_ship,fully_shipped,build_status,blocked_reason,created_at,updated_at'
    )
    .order('updated_at', { ascending: false })
    .limit(250);

  const kits = (data ?? []) as KitRecord[];
  const lineItems = (lineItemData ?? []) as KitLineRecord[];
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
        <>
          <KitTrackerClient kits={kits} />
          {lineItemError ? (
            <div className="erp-panel border-rose-200 bg-rose-50 p-5">
              <h2 className="text-base font-semibold text-rose-800">
                Kit line items table is not ready
              </h2>
              <p className="mt-2 text-sm leading-6 text-rose-700">
                Supabase returned: {lineItemError.message}. Apply
                `docs/supabase-kit-line-items.sql`, then reload this page.
              </p>
            </div>
          ) : (
            <KitLineImportPanel lineItems={lineItems} />
          )}
        </>
      )}
    </div>
  );
}
