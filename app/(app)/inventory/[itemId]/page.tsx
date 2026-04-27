import Link from 'next/link';
import { unstable_noStore as noStore } from 'next/cache';
import { notFound, redirect } from 'next/navigation';
import { SectionHeader } from '@/components/section-header';
import { RelatedAlerts } from '@/components/related-alerts';
import { StickyNotes } from '@/components/sticky-notes';
import { PrintInventoryTagButton, PrintLocationLabelButton } from '@/components/label-print-buttons';
import { getCurrentUserProfile } from '@/lib/auth/profile';
import { canDeleteInventory, canViewInventory } from '@/lib/auth/roles';
import { supabaseServer } from '@/lib/supabase/server';
import type { InventoryRecord } from '../types';
import { ArchiveInventoryItemButton } from './delete-inventory-item-button';

export const dynamic = 'force-dynamic';

function decodeItemId(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return '-';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString();
}

function numberValue(value: number | null | undefined) {
  return Number.isFinite(value) ? Number(value) : 0;
}

function stockStatus(item: InventoryRecord) {
  const qty = numberValue(item.qty_on_hand);
  const reorder = numberValue(item.reorder_point);

  if (qty <= 0) {
    return {
      label: 'Out of Stock',
      className: 'border-rose-200 bg-rose-50 text-rose-700',
    };
  }

  if (reorder > 0 && qty <= reorder) {
    return {
      label: 'Low Stock',
      className: 'border-amber-200 bg-amber-50 text-amber-700',
    };
  }

  return {
    label: 'In Stock',
    className: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  };
}

function DetailField({
  label,
  value,
}: {
  label: string;
  value: string | number | null | undefined;
}) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-sm font-semibold text-slate-900">
        {value === null || value === undefined || value === '' ? '-' : value}
      </div>
    </div>
  );
}

export default async function InventoryItemPage({
  params,
}: {
  params: { itemId: string };
}) {
  noStore();

  const profile = await getCurrentUserProfile();

  if (!canViewInventory(profile.role)) {
    redirect('/login');
  }

  const itemId = decodeItemId(params.itemId);
  const supabase = await supabaseServer();

  const { data, error } = await supabase
    .from('inventory')
    .select(
      'id,item_id,part_number,description,category,location,site,bin_location,qty_on_hand,reorder_point,created_at,updated_at,is_supply,is_active'
    )
    .eq('item_id', itemId)
    .eq('is_active', true)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    notFound();
  }

  const item = data as InventoryRecord;
  const status = stockStatus(item);
  const title = item.part_number || item.item_id;
  const location = [item.site || item.location, item.bin_location].filter(Boolean).join(' / ');
  const labelLocation = item.site || item.location;
  const hasLocationLabel = Boolean(labelLocation || item.bin_location);

  return (
    <div className="space-y-4">
      <SectionHeader
        title={title}
        subtitle="Inventory item detail, stock position, and operational notes."
        actions={
          <>
            <PrintInventoryTagButton item={item} />
            {hasLocationLabel ? (
              <PrintLocationLabelButton
                location={labelLocation}
                binLocation={item.bin_location}
              />
            ) : null}
            {canDeleteInventory(profile.role) ? (
              <ArchiveInventoryItemButton itemId={item.item_id} label={title} />
            ) : null}
            <Link href="/inventory" className="erp-button">
              Back to Inventory
            </Link>
          </>
        }
      />

      <StickyNotes entityType="inventory_item" entityId={item.item_id} title="Pinned Notes" />

      <RelatedAlerts
        title="Inventory Alerts"
        matchValues={[item.id, item.item_id, item.part_number || '']}
        matchTypes={['LOW_STOCK', 'OUT_OF_STOCK']}
      />

      <div className="erp-panel p-4">
        <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Item ID
            </div>
            <div className="mt-1 text-lg font-semibold text-slate-900">{item.item_id}</div>
            <div className="mt-1 text-xs text-slate-500">Database ID: {item.id}</div>
          </div>

          <span
            className={`inline-flex w-fit rounded-md border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${status.className}`}
          >
            {status.label}
          </span>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <DetailField label="Part Number" value={item.part_number} />
          <DetailField label="Category" value={item.category} />
          <DetailField label="Location" value={location} />
          <DetailField label="Supply Item" value={item.is_supply ? 'Yes' : 'No'} />
          <DetailField label="Qty On Hand" value={numberValue(item.qty_on_hand)} />
          <DetailField label="Reorder Point" value={numberValue(item.reorder_point)} />
          <DetailField label="Created At" value={formatDateTime(item.created_at)} />
          <DetailField label="Updated At" value={formatDateTime(item.updated_at)} />

          <div className="md:col-span-2 xl:col-span-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Description
            </div>
            <div className="mt-1 whitespace-pre-wrap text-sm text-slate-700">
              {item.description || '-'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
