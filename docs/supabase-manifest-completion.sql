-- Manifest completion workflow support.
--
-- Manifest stops are stored as rows in shipping_manifest_history. Completing a
-- manifest marks every stop for the manifest/date complete, keeps the rows for
-- history and printing, and records the operation in inventory_transactions.

alter table if exists public.shipping_manifest_history
  add column if not exists status text;

update public.shipping_manifest_history
set status = 'OPEN'
where status is null;

alter table if exists public.shipping_manifest_history
  alter column status set default 'OPEN';

alter table if exists public.shipping_manifest_history
  add column if not exists completed_at timestamptz,
  add column if not exists completed_by text;

create index if not exists shipping_manifest_history_manifest_date_status_idx
  on public.shipping_manifest_history(manifest_number, stop_date, status);

do $$
declare
  constraint_record record;
begin
  for constraint_record in
    select conname
    from pg_constraint
    where conrelid = 'public.inventory_transactions'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%transaction_type%'
  loop
    execute format(
      'alter table public.inventory_transactions drop constraint if exists %I',
      constraint_record.conname
    );
  end loop;
end $$;

alter table if exists public.inventory_transactions
  add constraint inventory_transactions_transaction_type_check
  check (
    transaction_type in (
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
      'STICKY_NOTE_DELETED'
    )
  );
