-- Signed BOM file storage and metadata
-- Run in Supabase SQL editor.

create extension if not exists pgcrypto;

insert into storage.buckets (id, name, public)
values ('signed-boms', 'signed-boms', false)
on conflict (id) do nothing;

create table if not exists public.signed_bom_files (
  id uuid primary key default gen_random_uuid(),
  manifest_number text,
  bom_number text,
  stop_id text,
  file_name text not null,
  file_path text not null,
  file_type text,
  uploaded_by text,
  uploaded_at timestamptz not null default now()
);

create index if not exists signed_bom_files_manifest_number_idx
  on public.signed_bom_files (manifest_number);

create index if not exists signed_bom_files_bom_number_idx
  on public.signed_bom_files (bom_number);

create index if not exists signed_bom_files_stop_id_idx
  on public.signed_bom_files (stop_id);

create index if not exists signed_bom_files_uploaded_at_idx
  on public.signed_bom_files (uploaded_at desc);

alter table public.signed_bom_files enable row level security;

drop policy if exists "signed_bom_files_select_authenticated" on public.signed_bom_files;
create policy "signed_bom_files_select_authenticated"
  on public.signed_bom_files
  for select
  to authenticated
  using (true);

drop policy if exists "signed_bom_files_insert_warehouse_admin" on public.signed_bom_files;
create policy "signed_bom_files_insert_warehouse_admin"
  on public.signed_bom_files
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.profiles
      where profiles.email = auth.email()
        and profiles.is_active = true
        and lower(coalesce(profiles.role, '')) in ('warehouse', 'admin')
    )
    or lower(coalesce(auth.jwt() ->> 'role', '')) = 'admin'
  );

drop policy if exists "signed_bom_files_delete_admin" on public.signed_bom_files;
create policy "signed_bom_files_delete_admin"
  on public.signed_bom_files
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.profiles
      where profiles.email = auth.email()
        and profiles.is_active = true
        and lower(coalesce(profiles.role, '')) = 'admin'
    )
    or lower(coalesce(auth.jwt() ->> 'role', '')) = 'admin'
  );

-- Storage access policies for private signed-boms bucket.
drop policy if exists "signed_boms_objects_select_authenticated" on storage.objects;
create policy "signed_boms_objects_select_authenticated"
  on storage.objects
  for select
  to authenticated
  using (bucket_id = 'signed-boms');

drop policy if exists "signed_boms_objects_insert_warehouse_admin" on storage.objects;
create policy "signed_boms_objects_insert_warehouse_admin"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'signed-boms'
    and (
      exists (
        select 1
        from public.profiles
        where profiles.email = auth.email()
          and profiles.is_active = true
          and lower(coalesce(profiles.role, '')) in ('warehouse', 'admin')
      )
      or lower(coalesce(auth.jwt() ->> 'role', '')) = 'admin'
    )
  );

drop policy if exists "signed_boms_objects_delete_admin" on storage.objects;
create policy "signed_boms_objects_delete_admin"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'signed-boms'
    and (
      exists (
        select 1
        from public.profiles
        where profiles.email = auth.email()
          and profiles.is_active = true
          and lower(coalesce(profiles.role, '')) = 'admin'
      )
      or lower(coalesce(auth.jwt() ->> 'role', '')) = 'admin'
    )
  );
