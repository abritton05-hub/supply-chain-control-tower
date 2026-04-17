import Link from 'next/link'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { SectionHeader } from '@/components/section-header'
import { supabaseServer } from '@/lib/supabase/server'

async function createInventoryItem(formData: FormData) {
  'use server'

  const itemId = (formData.get('item_id')?.toString() ?? '').trim()
  const partNumber = (formData.get('part_number')?.toString() ?? '').trim()
  const description = (formData.get('description')?.toString() ?? '').trim()
  const category = (formData.get('category')?.toString() ?? '').trim()
  const location = (formData.get('location')?.toString() ?? '').trim()

  const qtyOnHandRaw = formData.get('qty_on_hand')?.toString() ?? ''
  const reorderPointRaw = formData.get('reorder_point')?.toString() ?? ''
  const qtyOnHand = Number.parseInt(qtyOnHandRaw, 10)
  const reorderPoint = Number.parseInt(reorderPointRaw, 10)

  if (!itemId || !partNumber || !description || !category || !location) {
    redirect('/inventory/new?error=Please%20complete%20all%20required%20fields')
  }

  if (Number.isNaN(qtyOnHand) || Number.isNaN(reorderPoint)) {
    redirect('/inventory/new?error=Quantity%20and%20reorder%20point%20must%20be%20numbers')
  }

  if (qtyOnHand < 0 || reorderPoint < 0) {
    redirect('/inventory/new?error=Quantity%20and%20reorder%20point%20must%20be%20zero%20or%20greater')
  }

  const supabase = await supabaseServer()
  const { error } = await supabase.from('inventory').insert({
    item_id: itemId,
    part_number: partNumber,
    description,
    category,
    location,
    qty_on_hand: qtyOnHand,
    reorder_point: reorderPoint,
  })

  if (error) {
    redirect(`/inventory/new?error=${encodeURIComponent(error.message)}`)
  }

  revalidatePath('/inventory')
  redirect('/inventory')
}

export default async function NewInventoryPage({
  searchParams,
}: {
  searchParams?: { error?: string }
}) {
  const error = searchParams?.error

  return (
    <div className="space-y-4">
      <SectionHeader
        title="Add Supply"
        subtitle="Create a new inventory record in Supabase"
        actions={
          <Link href="/inventory" className="rounded border border-slate-300 bg-white px-2 py-1 text-xs">
            Back to Inventory
          </Link>
        }
      />

      <div className="erp-card p-4">
        {error ? (
          <div className="mb-4 rounded border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div>
        ) : null}

        <form action={createInventoryItem} className="grid gap-4 md:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700">Item ID</span>
            <input name="item_id" required className="rounded border border-slate-300 px-3 py-2" />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700">Part Number</span>
            <input name="part_number" required className="rounded border border-slate-300 px-3 py-2" />
          </label>

          <label className="flex flex-col gap-1 text-sm md:col-span-2">
            <span className="font-medium text-slate-700">Description</span>
            <input name="description" required className="rounded border border-slate-300 px-3 py-2" />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700">Category</span>
            <input name="category" required className="rounded border border-slate-300 px-3 py-2" />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700">Location</span>
            <input name="location" required className="rounded border border-slate-300 px-3 py-2" />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700">Qty On Hand</span>
            <input
              name="qty_on_hand"
              required
              type="number"
              step="1"
              className="rounded border border-slate-300 px-3 py-2"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700">Reorder Point</span>
            <input
              name="reorder_point"
              required
              type="number"
              step="1"
              className="rounded border border-slate-300 px-3 py-2"
            />
          </label>

          <div className="md:col-span-2 flex justify-end gap-2">
            <Link href="/inventory" className="rounded border border-slate-300 bg-white px-3 py-2 text-sm">
              Cancel
            </Link>
            <button type="submit" className="rounded border border-slate-300 bg-slate-900 px-3 py-2 text-sm text-white">
              Save Supply
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
