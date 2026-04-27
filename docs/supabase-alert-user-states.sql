-- Per-user alert read/dismiss state for computed ERP alerts.
-- Computed alerts continue to come from source operational tables; this table
-- only stores a user's local read/dismiss metadata.

create table if not exists public.alert_user_states (
  id uuid primary key default gen_random_uuid(),
  alert_key text not null,
  user_email text not null,
  read_at timestamptz,
  dismissed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (alert_key, user_email)
);

create index if not exists alert_user_states_user_email_idx
on public.alert_user_states (user_email);

create index if not exists alert_user_states_alert_key_idx
on public.alert_user_states (alert_key);

create or replace function public.set_alert_user_states_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_alert_user_states_updated_at on public.alert_user_states;

create trigger set_alert_user_states_updated_at
before update on public.alert_user_states
for each row
execute function public.set_alert_user_states_updated_at();

alter table public.alert_user_states enable row level security;

drop policy if exists "alert_user_states_select_own" on public.alert_user_states;
create policy "alert_user_states_select_own"
on public.alert_user_states
for select
to authenticated
using (lower(user_email) = lower(auth.jwt() ->> 'email'));

drop policy if exists "alert_user_states_insert_own" on public.alert_user_states;
create policy "alert_user_states_insert_own"
on public.alert_user_states
for insert
to authenticated
with check (lower(user_email) = lower(auth.jwt() ->> 'email'));

drop policy if exists "alert_user_states_update_own" on public.alert_user_states;
create policy "alert_user_states_update_own"
on public.alert_user_states
for update
to authenticated
using (lower(user_email) = lower(auth.jwt() ->> 'email'))
with check (lower(user_email) = lower(auth.jwt() ->> 'email'));
