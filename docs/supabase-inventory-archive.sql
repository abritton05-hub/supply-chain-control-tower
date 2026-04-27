-- Inventory archive support for admin-only deletes.
-- Apply this in the Supabase SQL editor before using inventory deletion.
--
-- Archived rows stay in public.inventory so historical transactions, pull request
-- lines, manifests, and BOM records can continue to reference the original item ID
-- and part number. Normal app inventory selectors filter to is_active = true.

alter table if exists public.inventory
  add column if not exists is_active boolean not null default true;

create index if not exists inventory_is_active_item_id_idx
  on public.inventory(is_active, item_id);

create index if not exists inventory_is_active_part_number_idx
  on public.inventory(is_active, part_number);

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
