-- Structured delivery stop items and box count support.
-- Apply this in the Supabase SQL editor before relying on structured stop lines.
--
-- Backward compatibility:
-- - shipping_manifest_history.items remains the legacy free-text item field.
-- - delivery_stop_items adds structured child rows for each stop.
-- - shipping_manifest_history.box_count stores the total boxes for the stop.

create extension if not exists pgcrypto;

alter table public.shipping_manifest_history
  add column if not exists box_count integer not null default 1;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'shipping_manifest_history_box_count_positive'
  ) then
    alter table public.shipping_manifest_history
      add constraint shipping_manifest_history_box_count_positive
      check (box_count >= 1);
  end if;
end $$;

create table if not exists public.delivery_stop_items (
  id uuid primary key default gen_random_uuid(),
  stop_id text not null references public.shipping_manifest_history(id) on delete cascade,
  part_number text,
  item_id text,
  description text,
  quantity numeric not null default 1,
  box_count integer not null default 1,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists delivery_stop_items_stop_id_idx
  on public.delivery_stop_items(stop_id);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'delivery_stop_items_quantity_positive'
  ) then
    alter table public.delivery_stop_items
      add constraint delivery_stop_items_quantity_positive
      check (quantity > 0);
  end if;

  alter table public.delivery_stop_items
    drop constraint if exists delivery_stop_items_box_count_positive;

  alter table public.delivery_stop_items
    add constraint delivery_stop_items_box_count_positive
    check (box_count >= 0);
end $$;

-- Best-effort backfill from legacy free-text items.
-- Lines shaped like "2x PN123 description" will populate quantity/part/description.
-- Other non-empty lines are preserved as description with quantity 1.
insert into public.delivery_stop_items (
  stop_id,
  part_number,
  description,
  quantity,
  box_count,
  notes
)
select
  stop.id,
  nullif((regexp_match(trim(line.value), '^\s*(?:qty\s*)?(\d+(?:\.\d+)?)\s*x?\s+([A-Za-z0-9][A-Za-z0-9_\-./]{2,})(?:\s+(.*))?\s*$'))[2], ''),
  coalesce(
    nullif((regexp_match(trim(line.value), '^\s*(?:qty\s*)?(\d+(?:\.\d+)?)\s*x?\s+([A-Za-z0-9][A-Za-z0-9_\-./]{2,})(?:\s+(.*))?\s*$'))[3], ''),
    trim(line.value)
  ),
  coalesce(
    nullif((regexp_match(trim(line.value), '^\s*(?:qty\s*)?(\d+(?:\.\d+)?)\s*x?\s+([A-Za-z0-9][A-Za-z0-9_\-./]{2,})(?:\s+(.*))?\s*$'))[1], '')::numeric,
    1
  ),
  coalesce(stop.box_count, 1),
  'Backfilled from shipping_manifest_history.items'
from public.shipping_manifest_history stop
cross join lateral regexp_split_to_table(coalesce(stop.items, ''), E'\r?\n') as line(value)
where trim(line.value) <> ''
  and not exists (
    select 1
    from public.delivery_stop_items existing
    where existing.stop_id = stop.id
  );
