import Link from 'next/link';
import { notFound } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase/server';
import type { InventoryRecord } from '../types';

function getStatus(qtyOnHand: number, reorderPoint: number) {
  if (qtyOnHand <= 0) return 'OUT';
  if (qtyOnHand <= reorderPoint) return 'LOW STOCK';
  return 'IN STOCK';
}

export default async function InventoryItemPage({ params }: { params: { itemId: string } }) {
  const supabase = await supabaseServer();

  const { data, error } = await supabase
    .from('inventory')
    .select(
      'id,item_id,part_number,description,category,location,qty_on_hand,reorder_point,created_at,updated_at'
    )
    .eq('item_id', params.itemId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) return notFound();

  const item = data as InventoryRecord;
  const qtyOnHand = item.qty_on_hand ?? 0;
  const reorderPoint = item.reorder_point ?? 0;
  const status = getStatus(qtyOnHand, reorderPoint);
  const qtyAboveReorder = qtyOnHand - reorderPoint;

  return (
    <div className="space-y-4">
      <div className="erp-panel p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <Link href="/inventory" className="text-sm font-semibold text-cyan-700 hover:underline">
              Back to Inventory
            </Link>
            <h1 className="mt-3 text-2xl font-semibold text-slate-900">{item.item_id}</h1>
            <p className="mt-1 text-sm leading-6 text-slate-600">{item.description}</p>
          </div>

          <span className="inline-flex rounded-full border border-slate-300 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
            {status}
          </span>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="erp-panel p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Part Number</div>
          <div className="mt-2 text-base font-semibold text-slate-900">{item.part_number || '-'}</div>
        </div>
        <div className="erp-panel p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Category</div>
          <div className="mt-2 text-base font-semibold text-slate-900">{item.category || '-'}</div>
        </div>
        <div className="erp-panel p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Location</div>
          <div className="mt-2 text-base font-semibold text-slate-900">{item.location || '-'}</div>
        </div>
        <div className="erp-panel p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Qty Above Reorder</div>
          <div className="mt-2 text-base font-semibold text-slate-900">{qtyAboveReorder}</div>
        </div>
      </div>

      <div className="erp-panel overflow-hidden">
        <div className="border-b border-slate-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-900">Inventory Details</h2>
        </div>
        <div className="grid gap-0 md:grid-cols-2">
          <div className="border-b border-slate-100 px-4 py-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Qty On Hand</div>
            <div className="mt-1 text-sm text-slate-800">{qtyOnHand}</div>
          </div>
          <div className="border-b border-slate-100 px-4 py-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Reorder Point</div>
            <div className="mt-1 text-sm text-slate-800">{reorderPoint}</div>
          </div>
          <div className="border-b border-slate-100 px-4 py-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Created</div>
            <div className="mt-1 text-sm text-slate-800">{item.created_at ? new Date(item.created_at).toLocaleString() : '-'}</div>
          </div>
          <div className="border-b border-slate-100 px-4 py-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Last Updated</div>
            <div className="mt-1 text-sm text-slate-800">{item.updated_at ? new Date(item.updated_at).toLocaleString() : '-'}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
