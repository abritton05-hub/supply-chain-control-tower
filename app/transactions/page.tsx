import Link from 'next/link'
import { DataTable } from '@/components/data-table'
import { KpiCard } from '@/components/kpi-card'
import { SectionHeader } from '@/components/section-header'
import { StatusChip } from '@/components/status-chip'
import { supabaseServer } from '@/lib/supabase/server'

type TransactionRow = {
  id: string
  item_id: string | null
  type: string | null
  quantity: number | null
  reference: string | null
  created_at: string | null
}

export default async function TransactionsPage() {
  const supabase = await supabaseServer()
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .order('created_at', { ascending: false })

  const rows: TransactionRow[] = data ?? []

  return (
    <div className="space-y-4">
      <SectionHeader title="Inventory Transactions" subtitle="Immutable movement history from Supabase" />
      <div className="grid gap-4 md:grid-cols-3">
        <KpiCard label="Visible Transactions" value={rows.length} />
        <KpiCard label="Receipts" value={rows.filter((r) => r.type === 'RECEIPT').length} />
        <KpiCard label="Issues" value={rows.filter((r) => r.type === 'ISSUE').length} />
      </div>

      {error ? (
        <div className="rounded border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          Unable to load transactions: {error.message}
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded border border-slate-200 bg-white p-6 text-sm text-slate-600">
          No transactions found.
        </div>
      ) : (
        <DataTable>
          <thead>
            <tr>{['Created At', 'Item ID', 'Type', 'Quantity', 'Reference'].map((h) => <th key={h}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>{row.created_at ? new Date(row.created_at).toLocaleString() : '—'}</td>
                <td>
                  {row.item_id ? (
                    <Link href={`/inventory/${row.item_id}`} className="text-cyan-700 hover:underline">
                      {row.item_id}
                    </Link>
                  ) : (
                    '—'
                  )}
                </td>
                <td>{row.type ? <StatusChip value={row.type} /> : '—'}</td>
                <td>{row.quantity ?? '—'}</td>
                <td>{row.reference ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </DataTable>
      )}
    </div>
  )
}
