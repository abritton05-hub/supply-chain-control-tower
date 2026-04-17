'use server'

import { supabaseServer } from '@/lib/supabase/server'

type InventoryInsertInput = {
  item_id: string
  part_number: string
  description: string
  category: string
  location: string
  qty_on_hand: number
  reorder_point: number
}

export async function fetchInventoryByItemId(itemId: string) {
  const supabase = await supabaseServer()
  return supabase
    .from('inventory')
    .select('*')
    .eq('item_id', itemId)
    .maybeSingle()
}

export async function insertInventoryRows(rows: InventoryInsertInput[]) {
  const supabase = await supabaseServer()
  return supabase.from('inventory').insert(rows)
}

export async function incrementInventory(itemId: string, quantity: number) {
  const supabase = await supabaseServer()
  return supabase.rpc('receive_inventory', {
    p_item_id: itemId,
    p_quantity: quantity,
    p_reference: null,
  })
}
