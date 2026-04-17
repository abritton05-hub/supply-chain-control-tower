create extension if not exists pgcrypto;

create table if not exists transactions (
  id uuid primary key default gen_random_uuid(),
  item_id text not null,
  type text not null check (type in ('RECEIPT', 'ISSUE', 'ADJUSTMENT')),
  quantity integer not null,
  reference text,
  created_at timestamp with time zone default now()
);

create or replace function receive_inventory(
  p_item_id text,
  p_quantity integer,
  p_reference text default null
)
returns void
language plpgsql
security definer
as $$
declare
  v_exists boolean;
begin
  if p_item_id is null or btrim(p_item_id) = '' then
    raise exception 'item_id is required';
  end if;

  if p_quantity is null or p_quantity <= 0 then
    raise exception 'quantity must be greater than 0';
  end if;

  select exists(select 1 from inventory where item_id = p_item_id) into v_exists;
  if not v_exists then
    raise exception 'item_id % not found in inventory', p_item_id;
  end if;

  update inventory
  set qty_on_hand = coalesce(qty_on_hand, 0) + p_quantity
  where item_id = p_item_id;

  insert into transactions (item_id, type, quantity, reference)
  values (p_item_id, 'RECEIPT', p_quantity, nullif(btrim(p_reference), ''));
end;
$$;
