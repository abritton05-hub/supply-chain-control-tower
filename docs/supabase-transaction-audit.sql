-- Transaction/audit logging support.
--
-- The app now writes operational audit entries into inventory_transactions so
-- the existing Transactions page can show one chronological feed. Older
-- inventory-only schemas may have NOT NULL constraints on item-specific fields
-- or a narrow transaction_type check constraint; this migration widens that
-- table without changing the receiving RPC contract.

alter table if exists public.inventory_transactions
  alter column item_id drop not null,
  alter column part_number drop not null,
  alter column description drop not null,
  alter column quantity drop not null,
  alter column from_location drop not null,
  alter column to_location drop not null;

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
      'DELIVERY_STOP_CREATED',
      'DELIVERY_STOP_UPDATED',
      'BOM_CREATED',
      'MANIFEST_PRINTED',
      'MANIFEST_SAVED',
      'STICKY_NOTE_CREATED',
      'STICKY_NOTE_UPDATED',
      'STICKY_NOTE_DELETED'
    )
  );
