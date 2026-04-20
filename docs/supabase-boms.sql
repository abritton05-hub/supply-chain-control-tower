create table if not exists public.boms (
  id uuid primary key default gen_random_uuid(),
  bom_number text not null unique,
  bom_date date not null,
  status text not null default 'Saved' check (status in ('Saved', 'Printed')),
  project_job_number text,
  ship_from text not null,
  ship_to text,
  po_number text,
  reference_number text,
  requested_by text,
  notes text,
  authorized_by text,
  authorized_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.boms
  add column if not exists status text not null default 'Saved';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'boms_status_check'
      and conrelid = 'public.boms'::regclass
  ) then
    alter table public.boms
      add constraint boms_status_check check (status in ('Saved', 'Printed'));
  end if;
end $$;

create table if not exists public.bom_lines (
  id uuid primary key default gen_random_uuid(),
  bom_id uuid not null references public.boms(id) on delete cascade,
  line_number integer not null,
  item text,
  part_number text,
  description text,
  qty numeric,
  unit text,
  created_at timestamptz not null default now()
);

create index if not exists boms_bom_date_idx
  on public.boms (bom_date desc);

create index if not exists boms_status_idx
  on public.boms (status);

create index if not exists bom_lines_bom_id_idx
  on public.bom_lines (bom_id);
