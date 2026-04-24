create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique,
  full_name text,
  role text not null default 'viewer' check (role in ('admin', 'ops_manager', 'warehouse', 'viewer')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role, is_active)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', null),
    'viewer',
    true
  )
  on conflict (id) do update
    set email = excluded.email,
        full_name = coalesce(excluded.full_name, public.profiles.full_name),
        updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_profile on auth.users;

create trigger on_auth_user_created_profile
after insert on auth.users
for each row
execute function public.handle_new_user_profile();

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own_or_admin" on public.profiles;
create policy "profiles_select_own_or_admin"
on public.profiles
for select
to authenticated
using (
  auth.uid() = id
  or lower(auth.jwt()->>'email') = lower(coalesce(current_setting('app.settings.admin_email', true), ''))
);

drop policy if exists "profiles_update_own_or_admin" on public.profiles;
create policy "profiles_update_own_or_admin"
on public.profiles
for update
to authenticated
using (
  auth.uid() = id
  or lower(auth.jwt()->>'email') = lower(coalesce(current_setting('app.settings.admin_email', true), ''))
)
with check (
  auth.uid() = id
  or lower(auth.jwt()->>'email') = lower(coalesce(current_setting('app.settings.admin_email', true), ''))
);

drop policy if exists "profiles_insert_admin_only" on public.profiles;
create policy "profiles_insert_admin_only"
on public.profiles
for insert
to authenticated
with check (
  lower(auth.jwt()->>'email') = lower(coalesce(current_setting('app.settings.admin_email', true), ''))
);