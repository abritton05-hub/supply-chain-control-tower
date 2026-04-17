import Link from 'next/link'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { SectionHeader } from '@/components/section-header'
import { supabaseServer } from '@/lib/supabase/server'

type InventoryInsertRow = {
  item_id: string
  part_number: string
  description: string
  category: string
  location: string
  qty_on_hand: number
  reorder_point: number
}

const REQUIRED_HEADERS = [
  'item_id',
  'part_number',
  'description',
  'category',
  'location',
  'qty_on_hand',
  'reorder_point',
]

function parseCsvLine(line: string): string[] {
  const values: string[] = []
  let current = ''
  let inQuotes = false

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]

    if (char === '"') {
      if (inQuotes && line[index + 1] === '"') {
        current += '"'
        index += 1
      } else {
        inQuotes = !inQuotes
      }
      continue
    }

    if (char === ',' && !inQuotes) {
      values.push(current)
      current = ''
      continue
    }

    current += char
  }

  values.push(current)
  return values
}

function summarizeReasons(reasons: Record<string, number>) {
  return Object.entries(reasons)
    .map(([reason, count]) => `${reason}:${count}`)
    .join(';')
}

async function uploadInventoryCsv(formData: FormData) {
  'use server'

  const file = formData.get('file') as File | null
  if (!file || file.size === 0) {
    redirect('/inventory/upload?error=Please%20choose%20a%20CSV%20file')
  }

  const text = await file.text()
  const lines = text
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)

  if (lines.length === 0) {
    redirect('/inventory/upload?error=CSV%20file%20is%20empty')
  }

  const headers = parseCsvLine(lines[0]).map((header) => header.trim().toLowerCase())
  const headerIndex = new Map(headers.map((header, index) => [header, index]))

  const missingHeaders = REQUIRED_HEADERS.filter((header) => !headerIndex.has(header))
  if (missingHeaders.length > 0) {
    redirect(`/inventory/upload?error=${encodeURIComponent(`Missing required column(s): ${missingHeaders.join(', ')}`)}`)
  }

  const validRows: InventoryInsertRow[] = []
  let skippedRows = 0
  const skippedReasons: Record<string, number> = {}

  const addReason = (reason: string) => {
    skippedReasons[reason] = (skippedReasons[reason] ?? 0) + 1
  }

  for (let lineIndex = 1; lineIndex < lines.length; lineIndex += 1) {
    const row = parseCsvLine(lines[lineIndex]).map((value) => value.trim())

    if (row.every((value) => value === '')) {
      continue
    }

    const itemId = row[headerIndex.get('item_id')!] ?? ''
    const partNumber = row[headerIndex.get('part_number')!] ?? ''
    const description = row[headerIndex.get('description')!] ?? ''
    const category = row[headerIndex.get('category')!] ?? ''
    const location = row[headerIndex.get('location')!] ?? ''
    const qtyOnHandRaw = row[headerIndex.get('qty_on_hand')!] ?? ''
    const reorderPointRaw = row[headerIndex.get('reorder_point')!] ?? ''

    if (!itemId || !partNumber || !description || !category || !location) {
      skippedRows += 1
      addReason('missing_required_fields')
      continue
    }

    const qtyOnHand = Number(qtyOnHandRaw)
    const reorderPoint = Number(reorderPointRaw)

    if (!Number.isFinite(qtyOnHand) || !Number.isFinite(reorderPoint)) {
      skippedRows += 1
      addReason('invalid_number_fields')
      continue
    }

    if (qtyOnHand < 0 || reorderPoint < 0) {
      skippedRows += 1
      addReason('negative_numbers_not_allowed')
      continue
    }

    validRows.push({
      item_id: itemId,
      part_number: partNumber,
      description,
      category,
      location,
      qty_on_hand: qtyOnHand,
      reorder_point: reorderPoint,
    })
  }

  if (validRows.length > 0) {
    const supabase = await supabaseServer()
    const { error } = await supabase.from('inventory').insert(validRows)

    if (error) {
      redirect(`/inventory/upload?error=${encodeURIComponent(error.message)}`)
    }
  }

  revalidatePath('/inventory')
  const reasonSummary = summarizeReasons(skippedReasons)
  redirect(
    `/inventory?imported=${validRows.length}&skipped=${skippedRows}&reasons=${encodeURIComponent(reasonSummary)}`
  )
}

export default function UploadInventoryCsvPage({
  searchParams,
}: {
  searchParams?: { error?: string }
}) {
  const error = searchParams?.error

  return (
    <div className="space-y-4">
      <SectionHeader
        title="Upload Inventory CSV"
        subtitle="Import supply rows into the Supabase inventory table"
        actions={
          <Link href="/inventory" className="rounded border border-slate-300 bg-white px-2 py-1 text-xs">
            Back to Inventory
          </Link>
        }
      />

      <div className="erp-card p-4 space-y-3">
        {error ? (
          <div className="rounded border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div>
        ) : null}

        <p className="text-sm text-slate-600">
          CSV must include: item_id, part_number, description, category, location, qty_on_hand, reorder_point.
        </p>

        <form action={uploadInventoryCsv} className="space-y-3">
          <input
            name="file"
            type="file"
            accept=".csv,text/csv"
            required
            className="block w-full rounded border border-slate-300 bg-white p-2 text-sm"
          />
          <div className="flex justify-end gap-2">
            <Link href="/inventory" className="rounded border border-slate-300 bg-white px-3 py-2 text-sm">
              Cancel
            </Link>
            <button type="submit" className="rounded border border-slate-300 bg-slate-900 px-3 py-2 text-sm text-white">
              Import CSV
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
