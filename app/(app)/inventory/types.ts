export type InventoryRecord = {
  id: string;
  item_id: string;
  part_number: string | null;
  description: string;
  category: string | null;
  location: string | null;
  site: string | null;
  bin_location: string | null;
  qty_on_hand: number | null;
  reorder_point: number | null;
  is_supply?: boolean | null;
  is_active?: boolean | null;
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
  site: string;
  bin_location: string;
  qty_on_hand: number | null;
  reorder_point: number | null;
  is_supply: boolean;
};

export type InventoryImportField =
  | 'item_id'
  | 'part_number'
  | 'description'
  | 'category'
  | 'location'
  | 'site'
  | 'bin_location'
  | 'qty_on_hand'
  | 'reorder_point';

export type InventoryImportInput = InventoryFormInput & {
  source_row_number?: number;
  invalid_reasons?: string[];
};

export type InventoryActionResult =
  | { ok: true; message: string; skipReasons?: string[] }
  | { ok: false; message: string; skipReasons?: string[] };
