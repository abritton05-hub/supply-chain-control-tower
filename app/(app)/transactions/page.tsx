import Link from 'next/link';
import { KpiCard } from '@/components/kpi-card';
import { SectionHeader } from '@/components/section-header';
import { StatusChip } from '@/components/status-chip';
import { supabaseServer } from '@/lib/supabase/server';
import type { InventoryTransaction } from '../receiving/types';

function formatDate(value: string | null) {
  if (!value) return '-';
  return new Date(`${value}T00:00:00`).toLocaleDateString();
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString();
}

export default async function TransactionsPage() {
  const supabase = await supabaseServer();

  const { data, error } = await supabase
    .from('inventory_transactions')
    .select(
      'id,transaction_date,item_id,part_number,description,transaction_type,quantity,from_location,to_location,reference,notes,performed_by,created_at'
    )
    .order('created_at', { ascending: false })
    .limit(500);

  if (error) {
    throw new Error(error.message);
  }

  const rows = (data ?? []) as InventoryTransaction[];
  const receipts = rows.filter((row) => row.transaction_type === 'RECEIPT').length;
  const issues = rows.filter((row) => row.transaction_type === 'ISSUE').length;

  return (
    <div className="space-y-4">
      <SectionHeader
        title="Transactions"
        subtitle="Inventory movement history written by receiving and future stock workflows"
      />

      <div className="grid gap-4 md:grid-cols-3">
        <KpiCard label="Visible Transactions" value={rows.length} />
        <KpiCard label="Receipts" value={receipts} />
        <KpiCard label="Issues" value={issues} />
      </div>

      <div className="erp-panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Item ID</th>
                <th className="px-4 py-3">Part Number</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Quantity</th>
                <th className="px-4 py-3">From</th>
                <th className="px-4 py-3">To</th>
                <th className="px-4 py-3">Reference</th>
                <th className="px-4 py-3">Performed By</th>
                <th className="px-4 py-3">Performed At</th>
                <th className="px-4 py-3">Notes</th>
              </tr>
            </thead>

            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-4 py-8 text-center text-slate-500">
                    No inventory transactions found.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id} className="border-b border-slate-100 align-top">
                    <td className="px-4 py-3 text-slate-700">
                      {formatDate(row.transaction_date)}
                    </td>
                    <td className="px-4 py-3 font-medium">
                      <Link href={`/inventory/${row.item_id}`} className="text-cyan-700 hover:underline">
                        {row.item_id}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{row.part_number || '-'}</td>
                    <td className="px-4 py-3">
                      <StatusChip value={row.transaction_type} />
                    </td>
                    <td className="px-4 py-3 text-slate-700">{row.quantity}</td>
                    <td className="px-4 py-3 text-slate-700">{row.from_location || '-'}</td>
                    <td className="px-4 py-3 text-slate-700">{row.to_location || '-'}</td>
                    <td className="px-4 py-3 text-slate-700">{row.reference || '-'}</td>
                    <td className="px-4 py-3 text-slate-700">{row.performed_by || '-'}</td>
                    <td className="px-4 py-3 text-slate-700">{formatDateTime(row.created_at)}</td>
                    <td className="px-4 py-3 text-slate-700">{row.notes || '-'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
