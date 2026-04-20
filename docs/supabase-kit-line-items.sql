create table if not exists public.kit_line_items (
  id uuid primary key default gen_random_uuid(),
  source_key text not null unique,
  kit_name text,
  part_number text,
  description text,
  rack_type text,
  vendor text,
  qty_required numeric,
  qty_on_hand numeric,
  qty_needed numeric,
  included_in_first_5_kits boolean,
  status text,
  eta_if_not_included text,
  order_reference text,
  notes text,
  risk text,
  ready_to_ship boolean,
  fully_shipped boolean,
  build_status text,
  blocked_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.kit_line_items
  alter column kit_name drop not null;

create index if not exists kit_line_items_kit_name_idx on public.kit_line_items (kit_name);
create index if not exists kit_line_items_part_number_idx on public.kit_line_items (part_number);
create index if not exists kit_line_items_rack_type_idx on public.kit_line_items (rack_type);
create index if not exists kit_line_items_status_idx on public.kit_line_items (status);
create index if not exists kit_line_items_ready_to_ship_idx on public.kit_line_items (ready_to_ship);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists kit_line_items_set_updated_at on public.kit_line_items;

create trigger kit_line_items_set_updated_at
before update on public.kit_line_items
for each row
execute function public.set_updated_at();
