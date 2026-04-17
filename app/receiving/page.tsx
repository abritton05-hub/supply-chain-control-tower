import Link from 'next/link'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { KpiCard } from '@/components/kpi-card'
import { SectionHeader } from '@/components/section-header'
import { supabaseServer } from '@/lib/supabase/server'

type InventoryItem = {
  item_id: string | null
  description: string | null
  qty_on_hand: number | null
}

async function receiveInventory(formData: FormData) {
  'use server'

  const itemId = (formData.get('item_id')?.toString() ?? '').trim()
  const quantityRaw = formData.get('quantity')?.toString() ?? ''
  const reference = (formData.get('reference')?.toString() ?? '').trim()

  const quantity = Number.parseInt(quantityRaw, 10)

  if (!itemId) {
    redirect('/receiving?error=Item%20ID%20is%20required')
  }

  if (!Number.isFinite(quantity) || quantity <= 0) {
    redirect('/receiving?error=Quantity%20must%20be%20a%20whole%20number%20greater%20than%200')
  }

  const supabase = await supabaseServer()

  const { data: existingItem, error: itemLookupError } = await supabase
    .from('inventory')
    .select('item_id')
    .eq('item_id', itemId)
    .maybeSingle()

  if (itemLookupError) {
    redirect(`/receiving?error=${encodeURIComponent(itemLookupError.message)}`)
  }

  if (!existingItem) {
    redirect('/receiving?error=Item%20does%20not%20exist%20in%20inventory')
  }

  const { error: rpcError } = await supabase.rpc('receive_inventory', {
    p_item_id: itemId,
    p_quantity: quantity,
    p_reference: reference || null,
  })

  if (rpcError) {
    const rpcMessage = rpcError.message.toLowerCase()

    if (rpcMessage.includes('function') && rpcMessage.includes('receive_inventory')) {
      redirect('/receiving?error=Missing%20database%20function%20receive_inventory.%20Run%20docs/sql/receive_inventory.sql')
    }

    if (rpcMessage.includes('relation') && rpcMessage.includes('transactions')) {
      redirect('/receiving?error=Missing%20transactions%20table.%20Run%20docs/sql/receive_inventory.sql')
    }

    redirect(`/receiving?error=${encodeURIComponent(rpcError.message)}`)
  }

  revalidatePath('/inventory')
  revalidatePath('/receiving')
  revalidatePath('/transactions')

  redirect(`/receiving?success=${encodeURIComponent(`Received ${quantity} units for ${itemId}`)}`)
}

export default async function ReceivingPage({
  searchParams,
}: {
  searchParams?: { success?: string; error?: string }
}) {
  const supabase = await supabaseServer()
  const { data, error } = await supabase
    .from('inventory')
    .select('item_id, description, qty_on_hand')
    .order('item_id', { ascending: true })

  const items: InventoryItem[] = data ?? []
  const success = searchParams?.success
  const formError = searchParams?.error

  return (
    <div className="space-y-4">
      <SectionHeader
        title="Receiving"
        subtitle="Receive inventory into stock and log an immutable transaction"
        actions={
          <Link href="/inventory" className="rounded border border-slate-300 bg-white px-2 py-1 text-xs">
            View Inventory
          </Link>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        <KpiCard label="Inventory Items" value={items.length} />
        <KpiCard
          label="Available for Receiving"
          value={items.filter((item) => (item.item_id ?? '').trim().length > 0).length}
        />
        <KpiCard label="Data Source" value="Supabase" />
      </div>

      <div className="erp-card p-4 space-y-4">
        {success ? (
          <div className="rounded border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{success}</div>
        ) : null}

        {formError ? (
          <div className="rounded border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{formError}</div>
        ) : null}

        {error ? (
          <div className="rounded border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
            Unable to load inventory items: {error.message}
          </div>
        ) : null}

        <form action={receiveInventory} className="grid gap-4 md:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm md:col-span-2">
            <span className="font-medium text-slate-700">Item ID</span>
            <input
              name="item_id"
              required
              list="receiving-item-options"
              placeholder="Enter item ID"
              className="rounded border border-slate-300 px-3 py-2"
            />
            <datalist id="receiving-item-options">
              {items.map((item) => (
                <option key={item.item_id ?? `item-${item.description ?? 'unknown'}`} value={item.item_id ?? ''}>
                  {item.description ?? ''}
                </option>
              ))}
            </datalist>
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700">Quantity Received</span>
            <input
              name="quantity"
              required
              type="number"
              min={1}
              step={1}
              className="rounded border border-slate-300 px-3 py-2"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700">Reference (optional)</span>
            <input
              name="reference"
              placeholder="PO number, shipment ID, etc."
              className="rounded border border-slate-300 px-3 py-2"
            />
          </label>

          <div className="md:col-span-2 flex justify-end gap-2">
            <Link href="/inventory" className="rounded border border-slate-300 bg-white px-3 py-2 text-sm">
              Cancel
            </Link>
            <button type="submit" className="rounded border border-slate-300 bg-slate-900 px-3 py-2 text-sm text-white">
              Post Receipt
            </button>
          </div>
        </form>
      </div>

      <div className="erp-card p-4 text-sm text-slate-600">
        <p className="font-semibold text-slate-800">Receiving process</p>
        <p>
          Posting a receipt runs the database function <code>receive_inventory</code>, which updates
          <code> inventory.qty_on_hand </code>
          and inserts a matching row into <code>transactions</code> with type <code>RECEIPT</code>.
        </p>
      </div>
    </div>
  )
}
