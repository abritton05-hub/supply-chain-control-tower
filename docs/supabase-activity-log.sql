create table if not exists public.activity_log (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id text,
  action_type text not null,
  title text not null,
  details jsonb,
  reference_number text,
  user_name text,
  created_at timestamptz not null default now()
);

create index if not exists activity_log_entity_idx
  on public.activity_log (entity_type, entity_id);
create index if not exists activity_log_action_type_idx
  on public.activity_log (action_type);
create index if not exists activity_log_reference_number_idx
  on public.activity_log (reference_number);
create index if not exists activity_log_created_at_idx
  on public.activity_log (created_at desc);

