-- Pull request fulfillment support.
-- Apply this in Supabase SQL editor before using the fulfillment API route.

alter table public.pull_request_lines
  add column if not exists quantity_fulfilled integer not null default 0,
  add column if not exists fulfillment_status text not null default 'OPEN',
  add column if not exists fulfilled_by text,
  add column if not exists fulfilled_at timestamptz;

alter table public.pull_requests
  add column if not exists fulfilled_by text,
  add column if not exists fulfilled_at timestamptz;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'pull_request_lines_quantity_fulfilled_nonnegative'
  ) then
    alter table public.pull_request_lines
      add constraint pull_request_lines_quantity_fulfilled_nonnegative
      check (quantity_fulfilled >= 0);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'pull_request_lines_quantity_fulfilled_not_over_requested'
  ) then
    alter table public.pull_request_lines
      add constraint pull_request_lines_quantity_fulfilled_not_over_requested
      check (quantity_fulfilled <= coalesce(quantity, 0));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'pull_request_lines_fulfillment_status_valid'
  ) then
    alter table public.pull_request_lines
      add constraint pull_request_lines_fulfillment_status_valid
      check (fulfillment_status in ('OPEN', 'PARTIAL', 'FULFILLED'));
  end if;
end $$;

create or replace function public.fulfill_pull_request_line(
  p_request_id uuid,
  p_line_id uuid,
  p_fulfill_quantity integer,
  p_performed_by text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_line public.pull_request_lines%rowtype;
  v_inventory public.inventory%rowtype;
  v_request_number text;
  v_remaining_quantity integer;
  v_new_line_fulfilled integer;
  v_line_status text;
  v_total_requested integer;
  v_total_fulfilled integer;
  v_request_status text;
  v_transaction_id public.inventory_transactions.id%type;
begin
  if p_fulfill_quantity is null or p_fulfill_quantity <= 0 then
    raise exception 'Fulfill quantity must be greater than 0.'
      using errcode = '22023';
  end if;

  select *
  into v_line
  from public.pull_request_lines
  where id = p_line_id
    and request_id = p_request_id
  for update;

  if not found then
    raise exception 'Pull request line was not found.'
      using errcode = 'P0002';
  end if;

  v_remaining_quantity := coalesce(v_line.quantity, 0) - coalesce(v_line.quantity_fulfilled, 0);

  if p_fulfill_quantity > v_remaining_quantity then
    raise exception 'Fulfill quantity cannot exceed remaining requested quantity.'
      using errcode = '22023';
  end if;

  select *
  into v_inventory
  from public.inventory
  where (v_line.item_id is not null and item_id = v_line.item_id)
    or (v_line.part_number is not null and part_number = v_line.part_number)
  order by
    case when v_line.item_id is not null and item_id = v_line.item_id then 0 else 1 end,
    item_id
  limit 1
  for update;

  if not found then
    raise exception 'No inventory item matches this pull request line.'
      using errcode = 'P0002';
  end if;

  if coalesce(v_inventory.qty_on_hand, 0) < p_fulfill_quantity then
    raise exception 'Fulfill quantity cannot exceed inventory qty_on_hand.'
      using errcode = '22023';
  end if;

  select request_number
  into v_request_number
  from public.pull_requests
  where id = p_request_id
  for update;

  update public.inventory
  set qty_on_hand = coalesce(qty_on_hand, 0) - p_fulfill_quantity,
      updated_at = now()
  where id = v_inventory.id;

  v_new_line_fulfilled := coalesce(v_line.quantity_fulfilled, 0) + p_fulfill_quantity;
  v_line_status := case
    when v_new_line_fulfilled = 0 then 'OPEN'
    when v_new_line_fulfilled < coalesce(v_line.quantity, 0) then 'PARTIAL'
    else 'FULFILLED'
  end;

  update public.pull_request_lines
  set quantity_fulfilled = v_new_line_fulfilled,
      fulfillment_status = v_line_status,
      fulfilled_by = coalesce(nullif(trim(p_performed_by), ''), fulfilled_by),
      fulfilled_at = case when v_line_status = 'FULFILLED' then now() else fulfilled_at end
  where id = v_line.id;

  insert into public.inventory_transactions (
    inventory_id,
    transaction_date,
    transaction_type,
    item_id,
    part_number,
    description,
    quantity,
    from_location,
    to_location,
    reference,
    notes,
    performed_by,
    created_at
  )
  values (
    v_inventory.id,
    current_date,
    'ISSUE',
    v_inventory.item_id,
    v_inventory.part_number,
    v_inventory.description,
    p_fulfill_quantity,
    coalesce(v_inventory.bin_location, v_inventory.location, v_line.location),
    'PULL REQUEST',
    coalesce(v_request_number, p_request_id::text),
    'Fulfilled pull request line ' || p_line_id::text,
    nullif(trim(p_performed_by), ''),
    now()
  )
  returning id into v_transaction_id;

  select
    coalesce(sum(coalesce(quantity, 0)), 0)::integer,
    coalesce(sum(coalesce(quantity_fulfilled, 0)), 0)::integer
  into v_total_requested, v_total_fulfilled
  from public.pull_request_lines
  where request_id = p_request_id;

  v_request_status := case
    when v_total_fulfilled = 0 then 'OPEN'
    when v_total_fulfilled < v_total_requested then 'PARTIAL'
    else 'FULFILLED'
  end;

  update public.pull_requests
  set status = v_request_status,
      fulfilled_by = case
        when v_request_status = 'FULFILLED'
        then coalesce(nullif(trim(p_performed_by), ''), fulfilled_by)
        else fulfilled_by
      end,
      fulfilled_at = case
        when v_request_status = 'FULFILLED'
        then now()
        else fulfilled_at
      end
  where id = p_request_id;

  return jsonb_build_object(
    'request_id', p_request_id,
    'line_id', p_line_id,
    'item_id', v_inventory.item_id,
    'part_number', v_inventory.part_number,
    'fulfill_quantity', p_fulfill_quantity,
    'line_quantity_fulfilled', v_new_line_fulfilled,
    'remaining_quantity', greatest(coalesce(v_line.quantity, 0) - v_new_line_fulfilled, 0),
    'line_status', v_line_status,
    'request_status', v_request_status,
    'transaction_id', v_transaction_id
  );
end;
$$;
