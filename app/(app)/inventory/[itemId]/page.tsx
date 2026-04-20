import Link from 'next/link';
import { notFound } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase/server';
import type { InventoryTransaction } from '../../receiving/types';
import type { InventoryRecord } from '../types';

function getStatus(qtyOnHand: number, reorderPoint: number) {
  if (qtyOnHand <= 0) return 'OUT';
  if (qtyOnHand <= reorderPoint) return 'LOW STOCK';
  return 'IN STOCK';
}

function formatDate(value: string | null | undefined) {
  if (!value) return '-';
  return new Date(`${value}T00:00:00`).toLocaleDateString();
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return '-';
  return new Date(value).toLocaleString();
}

function transactionDate(row: InventoryTransaction) {
  return row.transaction_date ?? row.created_at?.slice(0, 10) ?? null;
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
  const { data: transactionData, error: transactionError } = await supabase
    .from('inventory_transactions')
    .select(
      'id,transaction_date,item_id,part_number,description,transaction_type,quantity,from_location,to_location,reference,notes,performed_by,created_at'
    )
    .eq('item_id', item.item_id)
    .order('created_at', { ascending: false })
    .limit(25);

  const transactions = (transactionData ?? []) as InventoryTransaction[];
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
            <div className="mt-1 text-sm text-slate-800">{formatDateTime(item.created_at)}</div>
          </div>
          <div className="border-b border-slate-100 px-4 py-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Last Updated</div>
            <div className="mt-1 text-sm text-slate-800">{formatDateTime(item.updated_at)}</div>
          </div>
        </div>
      </div>

      <div className="erp-panel overflow-hidden">
        <div className="border-b border-slate-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-900">Recent Transaction History</h2>
          <p className="mt-1 text-xs text-slate-500">
            Receipts and future stock movements tied to this item.
          </p>
        </div>

        {transactionError ? (
          <div className="border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            Transaction history is unavailable. Supabase returned: {transactionError.message}. Apply
            `docs/supabase-receiving.sql`, then reload this page.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Quantity</th>
                  <th className="px-4 py-3">From</th>
                  <th className="px-4 py-3">To</th>
                  <th className="px-4 py-3">Reference</th>
                  <th className="px-4 py-3">Performed By</th>
                  <th className="px-4 py-3">Notes</th>
                </tr>
              </thead>

              <tbody>
                {transactions.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                      No inventory transactions found for this item.
                    </td>
                  </tr>
                ) : (
                  transactions.map((row) => (
                    <tr key={row.id} className="border-b border-slate-100 align-top">
                      <td className="px-4 py-3 text-slate-700">{formatDate(transactionDate(row))}</td>
                      <td className="px-4 py-3 font-medium text-slate-900">
                        {row.transaction_type}
                      </td>
                      <td className="px-4 py-3 text-slate-700">{row.quantity}</td>
                      <td className="px-4 py-3 text-slate-700">{row.from_location || '-'}</td>
                      <td className="px-4 py-3 text-slate-700">{row.to_location || '-'}</td>
                      <td className="px-4 py-3 text-slate-700">{row.reference || '-'}</td>
                      <td className="px-4 py-3 text-slate-700">{row.performed_by || '-'}</td>
                      <td className="px-4 py-3 text-slate-700">{row.notes || '-'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
