import { getCurrentUserEmail } from '@/lib/auth/session';
import { supabaseAdmin } from '@/lib/supabase/admin';

export const TRANSACTION_TYPES = [
  'RECEIPT',
  'ISSUE',
  'TRANSFER',
  'PULL_REQUEST_CREATED',
  'PULL_REQUEST_FULFILLED',
  'PULL_REQUEST_CLOSED',
  'INVENTORY_ADJUSTMENT',
  'INVENTORY_CREATED',
  'INVENTORY_UPDATED',
  'INVENTORY_ARCHIVED',
  'DELIVERY_STOP_CREATED',
  'DELIVERY_STOP_UPDATED',
  'BOM_CREATED',
  'MANIFEST_COMPLETED',
  'MANIFEST_PRINTED',
  'MANIFEST_SAVED',
  'STICKY_NOTE_CREATED',
  'STICKY_NOTE_UPDATED',
  'STICKY_NOTE_DELETED',
] as const;

export type TransactionType = (typeof TRANSACTION_TYPES)[number];

type SupabaseClientLike = Awaited<ReturnType<typeof supabaseAdmin>>;

export type LogTransactionInput = {
  transaction_type: TransactionType;
  transaction_date?: string | Date | null;
  item_id?: string | null;
  part_number?: string | null;
  description?: string | null;
  quantity?: number | null;
  from_location?: string | null;
  to_location?: string | null;
  reference?: string | null;
  notes?: string | null;
  performed_by?: string | null;
  entity_type?: string | null;
  entity_id?: string | null;
  title?: string | null;
  details?: Record<string, unknown> | null;
  write_inventory_transaction?: boolean;
  write_activity_log?: boolean;
  supabase?: SupabaseClientLike;
};

export type LogTransactionResult =
  | {
      ok: true;
      transactionId: string | null;
      activityLogged: boolean;
      message?: string;
    }
  | {
      ok: false;
      message: string;
      transactionId?: string | null;
      activityLogged?: boolean;
    };

function clean(value: string | null | undefined) {
  return value?.trim() || null;
}

function normalizeTransactionDate(value: string | Date | null | undefined) {
  if (!value) return new Date().toISOString().slice(0, 10);
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return value.slice(0, 10);
}

function buildTitle(input: LogTransactionInput) {
  if (clean(input.title)) return clean(input.title)!;

  const reference = clean(input.reference);
  const item = clean(input.part_number) || clean(input.item_id) || clean(input.description);
  const suffix = reference || item;

  return suffix ? `${input.transaction_type} ${suffix}` : input.transaction_type;
}

function buildDetails(input: LogTransactionInput) {
  return {
    ...(input.details ?? {}),
    transaction_type: input.transaction_type,
    transaction_date: normalizeTransactionDate(input.transaction_date),
    item_id: clean(input.item_id),
    part_number: clean(input.part_number),
    description: clean(input.description),
    quantity: input.quantity ?? null,
    from_location: clean(input.from_location),
    to_location: clean(input.to_location),
    reference: clean(input.reference),
    notes: clean(input.notes),
  };
}

export async function logTransaction(
  input: LogTransactionInput
): Promise<LogTransactionResult> {
  const writeInventoryTransaction = input.write_inventory_transaction ?? true;
  const writeActivityLog = input.write_activity_log ?? true;
  const supabase = input.supabase ?? (await supabaseAdmin());
  const currentUserEmail = await getCurrentUserEmail();
  const performedBy = clean(input.performed_by) || currentUserEmail || 'unknown';
  let transactionId: string | null = null;

  if (writeInventoryTransaction) {
    const { data, error } = await supabase
      .from('inventory_transactions')
      .insert({
        transaction_date: normalizeTransactionDate(input.transaction_date),
        transaction_type: input.transaction_type,
        item_id: clean(input.item_id),
        part_number: clean(input.part_number),
        description: clean(input.description),
        quantity: input.quantity ?? null,
        from_location: clean(input.from_location),
        to_location: clean(input.to_location),
        reference: clean(input.reference),
        notes: clean(input.notes),
        performed_by: performedBy,
      })
      .select('id')
      .maybeSingle();

    if (error) {
      return {
        ok: false,
        message: error.message,
        transactionId,
        activityLogged: false,
      };
    }

    transactionId = data?.id ? String(data.id) : null;
  }

  if (writeActivityLog) {
    const { error } = await supabase.from('activity_log').insert({
      entity_type: clean(input.entity_type) || 'transaction',
      entity_id: clean(input.entity_id) || transactionId,
      action_type: input.transaction_type,
      title: buildTitle(input),
      details: buildDetails(input),
      reference_number: clean(input.reference),
      user_name: performedBy,
    });

    if (error) {
      return {
        ok: false,
        message: error.message,
        transactionId,
        activityLogged: false,
      };
    }

    return {
      ok: true,
      transactionId,
      activityLogged: true,
    };
  }

  return {
    ok: true,
    transactionId,
    activityLogged: false,
  };
}
