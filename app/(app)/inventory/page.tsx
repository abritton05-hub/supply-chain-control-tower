import { unstable_noStore as noStore } from 'next/cache';
import { redirect } from 'next/navigation';
import { KpiCard } from '@/components/kpi-card';
import { SectionHeader } from '@/components/section-header';
import { getCurrentUserProfile } from '@/lib/auth/profile';
import { canEditInventory, canViewInventory } from '@/lib/auth/roles';
import { supabaseServer } from '@/lib/supabase/server';
import { InventoryClient } from './inventory-client';
import type { InventoryRecord } from './types';

export const dynamic = 'force-dynamic';

export default async function InventoryPage() {
  noStore();

  const profile = await getCurrentUserProfile();

  if (!canViewInventory(profile.role)) {
    redirect('/login');
  }

  const supabase = await supabaseServer();

  const { data, error } = await supabase
    .from('inventory')
    .select(
      'id,item_id,part_number,description,category,location,site,bin_location,qty_on_hand,reorder_point,created_at,updated_at,is_supply'
    )
    .order('item_id', { ascending: true });

  const inventory = (data ?? []) as InventoryRecord[];

  const lowStock = inventory.filter((item) => {
    const qty = item.qty_on_hand ?? 0;
    const reorder = item.reorder_point ?? 0;
    return qty > 0 && qty <= reorder;
  }).length;

  const outCount = inventory.filter((item) => (item.qty_on_hand ?? 0) <= 0).length;

  const inStock = inventory.filter((item) => {
    const qty = item.qty_on_hand ?? 0;
    const reorder = item.reorder_point ?? 0;
    return qty > reorder;
  }).length;

  return (
    <div className="space-y-4">
      <SectionHeader
        title="Inventory"
        subtitle="Operational stock, reorder points, site tabs, and bin-level visibility"
      />

      <div className="grid gap-3 md:grid-cols-4">
        <KpiCard label="Total Items" value={inventory.length} />
        <KpiCard label="In Stock" value={inStock} />
        <KpiCard label="Low Stock" value={lowStock} />
        <KpiCard label="Out" value={outCount} />
      </div>

      {error ? (
        <div className="erp-panel border-rose-200 bg-rose-50 p-5">
          <h2 className="text-base font-semibold text-rose-800">Inventory table is not ready</h2>
          <p className="mt-2 text-sm leading-6 text-rose-700">
            Supabase returned: {error.message}. Add the site and bin_location columns, then reload.
          </p>
        </div>
      ) : (
        <InventoryClient inventory={inventory} canEditInventory={canEditInventory(profile.role)} />
      )}
    </div>
  );
}
