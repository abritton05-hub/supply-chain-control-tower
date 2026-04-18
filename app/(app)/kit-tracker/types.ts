export const KIT_STATUSES = [
  'Not Started',
  'In Progress',
  'Blocked',
  'Ready',
  'Completed',
  'Delivery Requested',
  'Delivery Scheduled',
  'Delivered',
] as const;

export const BLOCK_REASONS = [
  'Waiting on Inventory',
  'Waiting on Receiving',
  'Waiting on Approval',
  'Waiting on Delivery Scheduling',
  'Other',
] as const;

export type KitStatus = (typeof KIT_STATUSES)[number];
export type BlockReason = (typeof BLOCK_REASONS)[number];

export type KitRecord = {
  id: string;
  kit_number: string;
  kit_name: string;
  project_name: string | null;
  location: string | null;
  status: KitStatus;
  block_reason: BlockReason | null;
  completed_date: string | null;
  delivery_requested: boolean;
  delivery_requested_date: string | null;
  delivery_scheduled_date: string | null;
  notes: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type KitFormInput = {
  id?: string;
  kit_number: string;
  kit_name: string;
  project_name: string;
  location: string;
  status: KitStatus;
  block_reason: BlockReason | '';
  completed_date: string;
  delivery_requested: boolean;
  delivery_requested_date: string;
  delivery_scheduled_date: string;
  notes: string;
};

export type KitActionResult =
  | { ok: true; message: string; summary?: KitImportSummary }
  | { ok: false; message: string };

export type KitImportSummary = {
  inserted: number;
  updated: number;
  skipped: number;
  skipReasons: string[];
};
