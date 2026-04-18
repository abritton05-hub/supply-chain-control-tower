export type InventoryRecord = {
  id: string;
  item_id: string;
  part_number: string | null;
  description: string;
  category: string | null;
  location: string | null;
  qty_on_hand: number | null;
  reorder_point: number | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type InventoryFormInput = {
  id?: string;
  item_id: string;
  part_number: string;
  description: string;
  category: string;
  location: string;
  qty_on_hand: number;
  reorder_point: number;
};

export type InventoryActionResult =
  | { ok: true; message: string }
  | { ok: false; message: string };
