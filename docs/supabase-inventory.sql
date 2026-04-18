create table if not exists public.inventory (
  id uuid primary key default gen_random_uuid(),
  item_id text not null unique,
  part_number text not null,
  description text not null,
  category text not null,
  location text not null,
  qty_on_hand numeric not null default 0 check (qty_on_hand >= 0),
  reorder_point numeric not null default 0 check (reorder_point >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists inventory_part_number_idx on public.inventory (part_number);
create index if not exists inventory_category_idx on public.inventory (category);
create index if not exists inventory_location_idx on public.inventory (location);

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
