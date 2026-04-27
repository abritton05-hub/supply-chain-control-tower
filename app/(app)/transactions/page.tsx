import Link from 'next/link';
import { redirect } from 'next/navigation';
import { SectionHeader } from '@/components/section-header';
import { getCurrentUserProfile } from '@/lib/auth/profile';
import { canViewTransactions } from '@/lib/auth/roles';
import { supabaseServer } from '@/lib/supabase/server';
import { TRANSACTION_TYPES } from '@/lib/transactions/log-transaction';
import type { InventoryTransaction } from '../receiving/types';

export const dynamic = 'force-dynamic';

type TransactionTypeFilter = (typeof TRANSACTION_TYPES)[number];

type Props = {
  searchParams?: {
    type?: string | string[];
  };
};

function selectedType(value: string | string[] | undefined): TransactionTypeFilter | 'ALL' {
  const rawValue = Array.isArray(value) ? value[0] : value;

  if (TRANSACTION_TYPES.some((type) => type === rawValue)) {
    return rawValue as TransactionTypeFilter;
  }

  return 'ALL';
}

function formatDate(value: string | null | undefined) {
  if (!value) return '-';
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T00:00:00`)
    : new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString();
}

function displayValue(value: string | number | null | undefined) {
  return value === null || value === undefined || value === '' ? '-' : value;
}

export default async function TransactionsPage({ searchParams }: Props) {
  const profile = await getCurrentUserProfile();

  if (!canViewTransactions(profile.role)) {
    redirect('/inventory');
  }

  const filterType = selectedType(searchParams?.type);
  const supabase = await supabaseServer();

  let query = supabase
    .from('inventory_transactions')
    .select(
      'id,transaction_date,transaction_type,item_id,part_number,description,quantity,from_location,to_location,reference,notes,performed_by,created_at'
    )
    .order('created_at', { ascending: false });

  if (filterType !== 'ALL') {
    query = query.eq('transaction_type', filterType);
  }

  const { data, error } = await query;
  const transactions = (data ?? []) as InventoryTransaction[];

  return (
    <div className="space-y-4">
      <SectionHeader
        title="Transactions"
        subtitle="Inventory movement history from receipts, issues, and transfers"
      />

      {error ? (
        <div className="erp-panel border-rose-200 bg-rose-50 p-5">
          <h2 className="text-base font-semibold text-rose-800">Transactions are not ready</h2>
          <p className="mt-2 text-sm leading-6 text-rose-700">
            Supabase returned: {error.message}. Apply the inventory transaction schema, then reload
            this page.
          </p>
        </div>
      ) : (
        <div className="erp-panel overflow-hidden">
          <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Inventory Transactions</h2>
              <p className="mt-1 text-xs text-slate-500">
                Showing {transactions.length} {filterType === 'ALL' ? 'total' : filterType.toLowerCase()}{' '}
                transaction{transactions.length === 1 ? '' : 's'}.
              </p>
            </div>

            <form action="/transactions" className="flex items-end gap-2">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Type
                </label>
                <select
                  name="type"
                  defaultValue={filterType}
                  className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800"
                >
                  <option value="ALL">All</option>
                  {TRANSACTION_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>
              <button type="submit" className="erp-button">
                Apply
              </button>
            </form>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Transaction Date</th>
                  <th className="px-4 py-3">Transaction Type</th>
                  <th className="px-4 py-3">Item ID</th>
                  <th className="px-4 py-3">Part Number</th>
                  <th className="px-4 py-3">Description</th>
                  <th className="px-4 py-3">Quantity</th>
                  <th className="px-4 py-3">From Location</th>
                  <th className="px-4 py-3">To Location</th>
                  <th className="px-4 py-3">Reference</th>
                  <th className="px-4 py-3">Notes</th>
                  <th className="px-4 py-3">Performed By</th>
                </tr>
              </thead>

              <tbody>
                {transactions.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="px-4 py-8 text-center text-slate-500">
                      No inventory transactions found.
                    </td>
                  </tr>
                ) : (
                  transactions.map((row) => (
                    <tr
                      key={row.id}
                      id={`transaction-${row.id}`}
                      className="scroll-mt-24 border-b border-slate-100 align-top target:bg-cyan-50"
                    >
                      <td className="px-4 py-3 text-slate-700">
                        {formatDate(row.transaction_date)}
                      </td>
                      <td className="px-4 py-3 text-slate-700">{row.transaction_type}</td>
                      <td className="px-4 py-3 font-medium">
                        {row.item_id ? (
                          <Link href={`/inventory/${row.item_id}`} className="text-cyan-700 hover:underline">
                            {row.item_id}
                          </Link>
                        ) : (
                          <span className="text-slate-500">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-700">{displayValue(row.part_number)}</td>
                      <td className="px-4 py-3 text-slate-700">{displayValue(row.description)}</td>
                      <td className="px-4 py-3 text-slate-700">{displayValue(row.quantity)}</td>
                      <td className="px-4 py-3 text-slate-700">{displayValue(row.from_location)}</td>
                      <td className="px-4 py-3 text-slate-700">{displayValue(row.to_location)}</td>
                      <td className="px-4 py-3 text-slate-700">{displayValue(row.reference)}</td>
                      <td className="px-4 py-3 text-slate-700">{displayValue(row.notes)}</td>
                      <td className="px-4 py-3 text-slate-700">{displayValue(row.performed_by)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
