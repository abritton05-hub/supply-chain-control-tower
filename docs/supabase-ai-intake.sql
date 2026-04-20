create extension if not exists pgcrypto;

create table if not exists public.ai_intake_documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  uploaded_by uuid null,
  source_type text not null check (source_type in ('image','pdf','text')),
  original_filename text null,
  mime_type text null,
  storage_path text null,
  raw_text text null,
  status text not null default 'uploaded' check (status in ('uploaded','classified','extracted','reviewed','rejected','error')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_intake_runs (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.ai_intake_documents(id) on delete cascade,
  run_type text not null check (run_type in ('classify','extract')),
  workflow_type text null check (workflow_type in ('receiving','pull_request','unknown')),
  model_name text not null,
  prompt_version text not null,
  raw_result jsonb not null default '{}'::jsonb,
  latency_ms integer null,
  success boolean not null default false,
  error_message text null,
  created_at timestamptz not null default now()
);

create table if not exists public.ai_intake_extractions (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.ai_intake_documents(id) on delete cascade,
  workflow_type text not null check (workflow_type in ('receiving','pull_request')),
  extracted_data jsonb not null default '{}'::jsonb,
  confidence_data jsonb not null default '{}'::jsonb,
  missing_fields jsonb not null default '[]'::jsonb,
  warnings jsonb not null default '[]'::jsonb,
  validation_issues jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_intake_reviews (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.ai_intake_documents(id) on delete cascade,
  reviewed_by uuid null,
  selected_workflow_type text not null check (selected_workflow_type in ('receiving','pull_request')),
  review_status text not null check (review_status in ('approved','edited','rejected')),
  reviewed_data jsonb not null default '{}'::jsonb,
  edited_fields jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists ai_intake_documents_organization_id_idx
  on public.ai_intake_documents (organization_id);

create index if not exists ai_intake_documents_status_idx
  on public.ai_intake_documents (status);

create index if not exists ai_intake_runs_document_id_idx
  on public.ai_intake_runs (document_id);

create index if not exists ai_intake_extractions_document_id_idx
  on public.ai_intake_extractions (document_id);

create index if not exists ai_intake_reviews_document_id_idx
  on public.ai_intake_reviews (document_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists ai_intake_documents_set_updated_at on public.ai_intake_documents;
create trigger ai_intake_documents_set_updated_at
before update on public.ai_intake_documents
for each row
execute function public.set_updated_at();

drop trigger if exists ai_intake_extractions_set_updated_at on public.ai_intake_extractions;
create trigger ai_intake_extractions_set_updated_at
before update on public.ai_intake_extractions
for each row
execute function public.set_updated_at();

insert into storage.buckets (id, name, public)
values ('ai-intake-documents', 'ai-intake-documents', false)
on conflict (id) do nothing;

alter table public.ai_intake_documents enable row level security;
alter table public.ai_intake_runs enable row level security;
alter table public.ai_intake_extractions enable row level security;
alter table public.ai_intake_reviews enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'ai_intake_documents'
      and policyname = 'ai_intake_documents_server_managed'
  ) then
    create policy ai_intake_documents_server_managed
      on public.ai_intake_documents
      for all
      using (true)
      with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'ai_intake_runs'
      and policyname = 'ai_intake_runs_server_managed'
  ) then
    create policy ai_intake_runs_server_managed
      on public.ai_intake_runs
      for all
      using (true)
      with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'ai_intake_extractions'
      and policyname = 'ai_intake_extractions_server_managed'
  ) then
    create policy ai_intake_extractions_server_managed
      on public.ai_intake_extractions
      for all
      using (true)
      with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'ai_intake_reviews'
      and policyname = 'ai_intake_reviews_server_managed'
  ) then
    create policy ai_intake_reviews_server_managed
      on public.ai_intake_reviews
      for all
      using (true)
      with check (true);
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'ai_intake_storage_server_managed'
  ) then
    create policy ai_intake_storage_server_managed
      on storage.objects
      for all
      using (bucket_id = 'ai-intake-documents')
      with check (bucket_id = 'ai-intake-documents');
  end if;
end;
$$;
