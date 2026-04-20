create table if not exists public.manifests (
  id uuid primary key default gen_random_uuid(),
  manifest_number text not null unique,
  document_title text not null,
  direction text not null check (direction in ('outgoing', 'incoming')),
  manifest_date date not null,
  manifest_time time not null,
  status text not null default 'Draft' check (status in ('Draft', 'Printed', 'Completed')),
  shipment_transfer_id text,
  driver_carrier text,
  vehicle text,
  reference_project_work_order text,
  from_location text not null,
  to_location text not null,
  authorized_for_release_by text,
  released_to_print_name text,
  company text,
  signature text,
  id_verified_by text,
  received_by text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.manifest_lines (
  id uuid primary key default gen_random_uuid(),
  manifest_id uuid not null references public.manifests(id) on delete cascade,
  line_number integer not null,
  item text,
  part_number text,
  description text,
  qty numeric,
  unit text,
  created_at timestamptz not null default now()
);

create index if not exists manifests_manifest_date_idx
  on public.manifests (manifest_date desc);

create index if not exists manifests_status_idx
  on public.manifests (status);

create index if not exists manifest_lines_manifest_id_idx
  on public.manifest_lines (manifest_id);
