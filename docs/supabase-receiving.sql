create table if not exists public.inventory_transactions (
  id uuid primary key default gen_random_uuid(),
  transaction_date date not null default current_date,
  item_id text not null references public.inventory(item_id) on update cascade,
  part_number text,
  description text,
  transaction_type text not null
    check (
      transaction_type in (
        'RECEIPT',
        'ISSUE',
        'TRANSFER',
        'ADJUSTMENT',
        'CYCLE COUNT',
        'BUILD ISSUE',
        'BUILD COMPLETE',
        'SHIP',
        'RETURN',
        'SCRAP',
        'LOCATION MOVE'
      )
    ),
  quantity numeric not null check (quantity > 0),
  from_location text,
  to_location text,
  reference text,
  notes text,
  performed_by text,
  created_at timestamptz not null default now()
);

create index if not exists inventory_transactions_item_id_idx
  on public.inventory_transactions (item_id);
create index if not exists inventory_transactions_type_idx
  on public.inventory_transactions (transaction_type);
create index if not exists inventory_transactions_created_at_idx
  on public.inventory_transactions (created_at desc);

create or replace function public.receive_inventory_item(
  p_item_id text,
  p_quantity numeric,
  p_reference text default null,
  p_notes text default null,
  p_performed_by text default null
)
returns uuid
language plpgsql
as $$
declare
  v_item public.inventory%rowtype;
  v_transaction_id uuid;
begin
  if p_item_id is null or btrim(p_item_id) = '' then
    raise exception 'Item ID is required.';
  end if;

  if p_quantity is null or p_quantity <= 0 then
    raise exception 'Received quantity must be greater than 0.';
  end if;

  select *
  into v_item
  from public.inventory
  where item_id = btrim(p_item_id)
  for update;

  if not found then
    raise exception 'Inventory item % does not exist.', p_item_id;
  end if;

  update public.inventory
  set qty_on_hand = qty_on_hand + p_quantity
  where id = v_item.id;

  insert into public.inventory_transactions (
    item_id,
    part_number,
    description,
    transaction_type,
    quantity,
    from_location,
    to_location,
    reference,
    notes,
    performed_by
  )
  values (
    v_item.item_id,
    v_item.part_number,
    v_item.description,
    'RECEIPT',
    p_quantity,
    'Receiving',
    v_item.location,
    nullif(btrim(coalesce(p_reference, '')), ''),
    nullif(btrim(coalesce(p_notes, '')), ''),
    nullif(btrim(coalesce(p_performed_by, '')), '')
  )
  returning id into v_transaction_id;

  return v_transaction_id;
end;
$$;
