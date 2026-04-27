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
  part_number: string;
  description: string;
  quantity: number;
  reference: string;
  notes: string;
  is_supply: boolean;
};

export type ReceivingImportField =
  | 'item_id'
  | 'part_number'
  | 'description'
  | 'quantity'
  | 'reference'
  | 'performed_by'
  | 'notes';

export type ReceivingMatchType = 'item_id' | 'part_number' | 'unresolved';

export type ReceivingImportInput = Omit<ReceiveInventoryInput, 'quantity'> & {
  quantity: number | null;
  source_row_number?: number;
  invalid_reasons?: string[];
  performed_by?: string;
  match_type?: ReceivingMatchType;
  target_item_id?: string;
  target_part_number?: string | null;
  target_description?: string | null;
};

export type InventoryTransaction = {
  id: string;
  transaction_date?: string | null;
  item_id: string | null;
  part_number: string | null;
  description: string | null;
  transaction_type: string;
  quantity: number | null;
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
