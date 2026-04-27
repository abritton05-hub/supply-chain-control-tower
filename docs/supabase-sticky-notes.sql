-- ERP sticky notes support.
-- Apply this in the Supabase SQL editor before using /api/sticky-notes.

create table if not exists public.sticky_notes (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id text not null,
  note text not null,
  priority text not null default 'info',
  is_pinned boolean not null default true,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sticky_notes_priority_check
    check (priority in ('info', 'warning', 'critical'))
);

create index if not exists sticky_notes_entity_idx
on public.sticky_notes (entity_type, entity_id);

create index if not exists sticky_notes_priority_idx
on public.sticky_notes (priority);

create index if not exists sticky_notes_created_at_idx
on public.sticky_notes (created_at);

create or replace function public.set_sticky_notes_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_sticky_notes_updated_at on public.sticky_notes;

create trigger set_sticky_notes_updated_at
before update on public.sticky_notes
for each row
execute function public.set_sticky_notes_updated_at();

alter table public.sticky_notes enable row level security;

drop policy if exists "sticky_notes_select_authenticated" on public.sticky_notes;
create policy "sticky_notes_select_authenticated"
on public.sticky_notes
for select
to authenticated
using (true);

drop policy if exists "sticky_notes_insert_authenticated" on public.sticky_notes;
create policy "sticky_notes_insert_authenticated"
on public.sticky_notes
for insert
to authenticated
with check (true);

drop policy if exists "sticky_notes_update_authenticated" on public.sticky_notes;
create policy "sticky_notes_update_authenticated"
on public.sticky_notes
for update
to authenticated
using (true)
with check (true);

drop policy if exists "sticky_notes_delete_authenticated" on public.sticky_notes;
create policy "sticky_notes_delete_authenticated"
on public.sticky_notes
for delete
to authenticated
using (true);
