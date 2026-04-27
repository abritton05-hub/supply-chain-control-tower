import { unstable_noStore as noStore } from 'next/cache';
import { redirect } from 'next/navigation';
import { SectionHeader } from '@/components/section-header';
import { getCurrentUserProfile } from '@/lib/auth/profile';
import { canFulfillPullRequests, canSubmitPullRequests } from '@/lib/auth/roles';
import { supabaseServer } from '@/lib/supabase/server';
import type { InventoryRecord } from '../inventory/types';
import { PullRequestClient } from './pull-request-client';

export const dynamic = 'force-dynamic';

export default async function PullRequestsPage({
  searchParams,
}: {
  searchParams?: { item?: string | string[] };
}) {
  noStore();

  const profile = await getCurrentUserProfile();

  if (!canSubmitPullRequests(profile.role)) {
    redirect('/inventory');
  }

  const supabase = await supabaseServer();

  const { data, error } = await supabase
    .from('inventory')
    .select('id,item_id,part_number,description,category,location,qty_on_hand,reorder_point,is_active')
    .eq('is_active', true)
    .order('item_id', { ascending: true });

  const inventory = (data ?? []) as InventoryRecord[];
  const initialItemQuery = Array.isArray(searchParams?.item)
    ? searchParams?.item[0]
    : searchParams?.item;

  return (
    <div className="space-y-4">
      <SectionHeader
        title="Pull Requests"
        subtitle="Fast field requests for parts, bins, and replenishment work"
      />

      {error ? (
        <div className="erp-panel border-rose-200 bg-rose-50 p-5">
          <h2 className="text-base font-semibold text-rose-800">Inventory lookup is not ready</h2>
          <p className="mt-2 text-sm leading-6 text-rose-700">
            Supabase returned: {error.message}. Pull requests need inventory lookup before
            technicians can select parts.
          </p>
        </div>
      ) : (
        <PullRequestClient
          inventory={inventory}
          initialItemQuery={initialItemQuery ?? ''}
          canFulfillRequests={canFulfillPullRequests(profile.role)}
        />
      )}
    </div>
  );
}
