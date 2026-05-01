-- Regiões para segmentar vendas (ex.: Pará, Maranhão, Piauí)

create table if not exists public.regions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique (organization_id, name)
);

create index if not exists regions_org_id_idx on public.regions(organization_id);

alter table public.regions enable row level security;

create policy "regions_all"
  on public.regions
  for all
  to authenticated
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

alter table public.sales add column if not exists region_id uuid null references public.regions(id) on delete set null;
create index if not exists sales_region_id_idx on public.sales(region_id);

