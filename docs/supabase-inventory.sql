create extension if not exists pgcrypto;

create table if not exists public.inventory (
  id uuid default gen_random_uuid(),
  item_id text,
  part_number text,
  description text,
  category text,
  location text,
  qty_on_hand numeric default 0,
  reorder_point numeric default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.inventory
  add column if not exists id uuid default gen_random_uuid(),
  add column if not exists item_id text,
  add column if not exists part_number text,
  add column if not exists description text,
  add column if not exists category text,
  add column if not exists location text,
  add column if not exists qty_on_hand numeric default 0,
  add column if not exists reorder_point numeric default 0,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

update public.inventory
set id = gen_random_uuid()
where id is null;

update public.inventory
set item_id = 'INV-' || upper(substr(id::text, 1, 8))
where item_id is null or btrim(item_id) = '';

update public.inventory
set part_number = 'PENDING-' || upper(substr(item_id, 1, 56))
where part_number is null or btrim(part_number) = '';

update public.inventory
set description = 'Pending description'
where description is null or btrim(description) = '';

update public.inventory
set category = 'Uncategorized'
where category is null or btrim(category) = '';

update public.inventory
set location = 'Unassigned'
where location is null or btrim(location) = '';

alter table public.inventory
  alter column qty_on_hand type numeric using
    case
      when qty_on_hand is null then 0
      when qty_on_hand::text ~ '^-?[0-9]+(\.[0-9]+)?$' then qty_on_hand::text::numeric
      else 0
    end,
  alter column reorder_point type numeric using
    case
      when reorder_point is null then 0
      when reorder_point::text ~ '^-?[0-9]+(\.[0-9]+)?$' then reorder_point::text::numeric
      else 0
    end;

update public.inventory
set qty_on_hand = 0
where qty_on_hand is null or qty_on_hand < 0;

update public.inventory
set reorder_point = 0
where reorder_point is null or reorder_point < 0;

update public.inventory
set created_at = now()
where created_at is null;

update public.inventory
set updated_at = coalesce(updated_at, created_at, now())
where updated_at is null;

do $$
begin
  if exists (
    select 1
    from public.inventory
    group by item_id
    having count(*) > 1
  ) then
    raise exception 'Cannot add inventory.item_id uniqueness because duplicate item_id values exist. Deduplicate inventory.item_id before rerunning this script.';
  end if;

  if exists (
    select 1
    from public.inventory
    group by part_number
    having count(*) > 1
  ) then
    raise exception 'Cannot add inventory.part_number uniqueness because duplicate part_number values exist. Deduplicate inventory.part_number before rerunning this script.';
  end if;
end;
$$;

alter table public.inventory
  alter column id set default gen_random_uuid(),
  alter column id set not null,
  alter column item_id set not null,
  alter column part_number set not null,
  alter column description set not null,
  alter column category set not null,
  alter column location set not null,
  alter column qty_on_hand set default 0,
  alter column qty_on_hand set not null,
  alter column reorder_point set default 0,
  alter column reorder_point set not null,
  alter column created_at set default now(),
  alter column created_at set not null,
  alter column updated_at set default now(),
  alter column updated_at set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.inventory'::regclass
      and contype = 'p'
  ) then
    alter table public.inventory
      add constraint inventory_pkey primary key (id);
  end if;
end;
$$;

create unique index if not exists inventory_id_unique_idx
  on public.inventory (id);

create unique index if not exists inventory_item_id_unique_idx
  on public.inventory (item_id);

create unique index if not exists inventory_part_number_unique_idx
  on public.inventory (part_number);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.inventory'::regclass
      and conname = 'inventory_qty_on_hand_nonnegative'
  ) then
    alter table public.inventory
      add constraint inventory_qty_on_hand_nonnegative check (qty_on_hand >= 0) not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.inventory'::regclass
      and conname = 'inventory_reorder_point_nonnegative'
  ) then
    alter table public.inventory
      add constraint inventory_reorder_point_nonnegative check (reorder_point >= 0) not valid;
  end if;
end;
$$;

create index if not exists inventory_category_idx
  on public.inventory (category);

create index if not exists inventory_location_idx
  on public.inventory (location);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists inventory_set_updated_at on public.inventory;

create trigger inventory_set_updated_at
before update on public.inventory
for each row
execute function public.set_updated_at();
