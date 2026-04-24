export type KitLineImportInput = {
  source_row_number?: number;
  kit_name: string;
  part_number: string;
  description: string;
  rack_type: string;
  vendor: string;
  qty_required: number | null;
  qty_on_hand: number | null;
  qty_needed: number | null;
  included_in_first_5_kits: boolean | null;
  status: string;
  eta_if_not_included: string;
  order_reference: string;
  notes: string;
  risk: string;
  ready_to_ship: boolean | null;
  fully_shipped: boolean | null;
  build_status: string;
  blocked_reason: string;
};

export type KitLineField = keyof Omit<KitLineImportInput, 'source_row_number'>;

export type KitLineRecord = {
  id: string;
  source_key: string;
  kit_name: string | null;
  part_number: string | null;
  description: string | null;
  rack_type: string | null;
  vendor: string | null;
  qty_required: number | null;
  qty_on_hand: number | null;
  qty_needed: number | null;
  included_in_first_5_kits: boolean | null;
  status: string | null;
  eta_if_not_included: string | null;
  order_reference: string | null;
  notes: string | null;
  risk: string | null;
  ready_to_ship: boolean | null;
  fully_shipped: boolean | null;
  build_status: string | null;
  blocked_reason: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type KitLineImportSummary = {
  inserted: number;
  updated: number;
  incompleteUsable?: number;
  skippedBlank: number;
  skippedInvalid: number;
  skipReasons: string[];
};

export type KitLineImportResult =
  | { ok: true; message: string; summary?: KitLineImportSummary }
  | { ok: false; message: string; summary?: KitLineImportSummary };
