import Link from 'next/link'
import { DataTable } from '@/components/data-table'
import { KpiCard } from '@/components/kpi-card'
import { SectionHeader } from '@/components/section-header'
import { StatusChip } from '@/components/status-chip'
import { supabaseServer } from '@/lib/supabase/server'

type InventoryRow = {
  id: string
  item_id: string | null
  part_number: string | null
  description: string | null
  category: string | null
  location: string | null
  qty_on_hand: number | null
  reorder_point: number | null
  created_at: string | null
}

function inventoryStatus(qtyOnHand: number, reorderPoint: number) {
  if (qtyOnHand <= 0) return 'OUT'
  if (qtyOnHand <= reorderPoint) return 'LOW STOCK'
  return 'IN STOCK'
}

export default async function InventoryPage({
  searchParams,
}: {
  searchParams?: { imported?: string; skipped?: string; reasons?: string; error?: string }
}) {
  const supabase = await supabaseServer()

  const { data: inventory, error } = await supabase
    .from('inventory')
    .select('*')
    .order('created_at', { ascending: false })

  const rows: InventoryRow[] = inventory ?? []
  const importedCount = Number(searchParams?.imported ?? 0)
  const skippedCount = Number(searchParams?.skipped ?? 0)
  const reasonSummary = (searchParams?.reasons ?? "").trim()

  const outCount = rows.filter((item) => (item.qty_on_hand ?? 0) <= 0).length
  const lowCount = rows.filter((item) => {
    const qty = item.qty_on_hand ?? 0
    const reorderPoint = item.reorder_point ?? 0
    return qty > 0 && qty <= reorderPoint
  }).length

  return (
    <div>
      <SectionHeader
        title="Inventory Database"
        subtitle="Operational inventory visibility with live Supabase data"
        actions={
          <div className="flex gap-2">
            <Link href="/inventory/upload" className="rounded border border-slate-300 bg-white px-2 py-1 text-xs">
              Upload CSV
            </Link>
            <Link href="/inventory/new" className="rounded border border-slate-300 bg-white px-2 py-1 text-xs">
              Add Supply
            </Link>
          </div>
        }
      />
      <div className="erp-banner">
        <p className="text-sm font-semibold">Inventory command view</p>
        <p className="text-xs text-slate-200">
          Real-time inventory records sourced from your Supabase inventory table.
        </p>
      </div>

      {importedCount > 0 || skippedCount > 0 ? (
        <div className="mb-4 rounded border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          <p>CSV import complete. Inserted: {importedCount}. Skipped: {skippedCount}.</p>
          {reasonSummary ? <p className="text-xs text-emerald-700">Skipped reasons: {reasonSummary}</p> : null}
        </div>
      ) : null}

      <div className="mb-4 grid gap-4 md:grid-cols-4">
        <KpiCard label="Total Items" value={rows.length} />
        <KpiCard label="Out of Stock" value={outCount} />
        <KpiCard label="Low Stock" value={lowCount} />
        <KpiCard label="Data Source" value="Supabase" />
      </div>

      {error ? (
        <div className="rounded border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          Unable to load inventory from Supabase: {error.message}
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded border border-slate-200 bg-white p-6 text-sm text-slate-600">
          No inventory rows found.
        </div>
      ) : (
        <DataTable>
          <thead>
            <tr>
              {[
                'Item ID',
                'Part Number',
                'Description',
                'Category',
                'Location',
                'Qty On Hand',
                'Reorder Point',
                'Status',
                'Created At',
              ].map((h) => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((item) => {
              const qtyOnHand = item.qty_on_hand ?? 0
              const reorderPoint = item.reorder_point ?? 0
              const status = inventoryStatus(qtyOnHand, reorderPoint)

              return (
                <tr key={item.id} className={status !== 'IN STOCK' ? 'bg-rose-50' : ''}>
                  <td className="font-semibold">{item.item_id ?? '—'}</td>
                  <td>{item.part_number ?? '—'}</td>
                  <td>{item.description ?? '—'}</td>
                  <td>{item.category ?? '—'}</td>
                  <td>{item.location ?? '—'}</td>
                  <td>{qtyOnHand}</td>
                  <td>{reorderPoint}</td>
                  <td>
                    <StatusChip value={status} />
                  </td>
                  <td>{item.created_at ? new Date(item.created_at).toLocaleString() : '—'}</td>
                </tr>
              )
            })}
          </tbody>
        </DataTable>
      )}
    </div>
  )
}
