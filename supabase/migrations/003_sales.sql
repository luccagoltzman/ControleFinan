-- Vendas (simples) + RLS

create table if not exists public.sales (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  sold_at timestamptz not null,
  qty numeric(12, 3) not null check (qty > 0),
  unit_price numeric(12, 2) not null check (unit_price >= 0),
  unit_cost_snapshot numeric(12, 2) not null check (unit_cost_snapshot >= 0),
  notes text null,
  created_at timestamptz not null default now()
);

create index if not exists sales_org_id_idx on public.sales(organization_id);
create index if not exists sales_product_id_idx on public.sales(product_id);
create index if not exists sales_sold_at_idx on public.sales(sold_at desc);

alter table public.sales enable row level security;

drop policy if exists sales_all on public.sales;
create policy sales_all
on public.sales
for all
to authenticated
using (public.is_org_member(organization_id))
with check (public.is_org_member(organization_id));

