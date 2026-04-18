create table if not exists public.kits (
  id uuid primary key default gen_random_uuid(),
  kit_number text not null unique,
  kit_name text not null,
  project_name text,
  location text,
  status text not null default 'Not Started'
    check (
      status in (
        'Not Started',
        'In Progress',
        'Blocked',
        'Ready',
        'Completed',
        'Delivery Requested',
        'Delivery Scheduled',
        'Delivered'
      )
    ),
  block_reason text
    check (
      block_reason is null
      or block_reason in (
        'Waiting on Inventory',
        'Waiting on Receiving',
        'Waiting on Approval',
        'Waiting on Delivery Scheduling',
        'Other'
      )
    ),
  completed_date date,
  delivery_requested boolean not null default false,
  delivery_requested_date date,
  delivery_scheduled_date date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists kits_status_idx on public.kits (status);
create index if not exists kits_location_idx on public.kits (location);
create index if not exists kits_project_name_idx on public.kits (project_name);
create index if not exists kits_delivery_scheduled_date_idx
  on public.kits (delivery_scheduled_date);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists kits_set_updated_at on public.kits;

create trigger kits_set_updated_at
before update on public.kits
for each row
execute function public.set_updated_at();
