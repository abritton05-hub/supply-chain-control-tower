import { redirect } from 'next/navigation';
import { SectionHeader } from '@/components/section-header';
import { getCurrentUserProfile } from '@/lib/auth/profile';
import { canReceiveInventory } from '@/lib/auth/roles';
import { supabaseServer } from '@/lib/supabase/server';
import { ReceivingClient } from './receiving-client';
import type { InventoryOption, InventoryTransaction } from './types';

export const dynamic = 'force-dynamic';

export default async function ReceivingPage({
  searchParams,
}: {
  searchParams?: { item?: string | string[] };
}) {
  const profile = await getCurrentUserProfile();

  if (!canReceiveInventory(profile.role)) {
    redirect('/inventory');
  }

  const supabase = await supabaseServer();

  const { data: inventoryData, error: inventoryError } = await supabase
    .from('inventory')
    .select('id,item_id,part_number,description,category,location,qty_on_hand,reorder_point,is_active')
    .eq('is_active', true)
    .order('item_id', { ascending: true });

  const { data: receiptData, error: receiptError } = await supabase
    .from('inventory_transactions')
    .select(
      'id,transaction_date,item_id,part_number,description,transaction_type,quantity,from_location,to_location,reference,notes,performed_by,created_at'
    )
    .eq('transaction_type', 'RECEIPT')
    .order('created_at', { ascending: false })
    .limit(50);

  const inventory = (inventoryData ?? []) as InventoryOption[];
  const receipts = (receiptData ?? []) as InventoryTransaction[];
  const initialItemQuery = Array.isArray(searchParams?.item)
    ? searchParams?.item[0]
    : searchParams?.item;

  const setupError = inventoryError?.message ?? receiptError?.message ?? '';

  return (
    <div className="space-y-4">
      <SectionHeader
        title="Receiving"
        subtitle="Receive stock against existing inventory items and write the transaction log"
      />

      {setupError ? (
        <div className="erp-panel border-rose-200 bg-rose-50 p-5">
          <h2 className="text-base font-semibold text-rose-800">Receiving is not ready</h2>
          <p className="mt-2 text-sm leading-6 text-rose-700">
            Supabase returned: {setupError}. Apply `docs/supabase-receiving.sql`, then reload this
            page.
          </p>
        </div>
      ) : (
        <ReceivingClient
          inventory={inventory}
          recentReceipts={receipts}
          initialItemQuery={initialItemQuery ?? ''}
        />
      )}
    </div>
  );
}
