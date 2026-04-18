export type InventoryOption = {
  id: string;
  item_id: string;
  part_number: string | null;
  description: string;
  category: string | null;
  location: string | null;
  qty_on_hand: number | null;
  reorder_point: number | null;
};

export type ReceiveInventoryInput = {
  item_id: string;
  quantity: number;
  reference: string;
  notes: string;
  performed_by: string;
};

export type InventoryTransaction = {
  id: string;
  transaction_date: string;
  item_id: string;
  part_number: string | null;
  description: string | null;
  transaction_type: string;
  quantity: number;
  from_location: string | null;
  to_location: string | null;
  reference: string | null;
  notes: string | null;
  performed_by: string | null;
  created_at: string;
};

export type ReceiveActionResult =
  | { ok: true; message: string }
  | { ok: false; message: string };
