-- Preço fixo por unidade (kg/un) por produto

create table if not exists public.product_sale_prices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  unit text not null check (unit in ('kg', 'un')),
  price numeric(12, 2) not null check (price >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, unit)
);

create index if not exists product_sale_prices_org_id_idx on public.product_sale_prices(organization_id);
create index if not exists product_sale_prices_product_id_idx on public.product_sale_prices(product_id);

alter table public.product_sale_prices enable row level security;

drop policy if exists product_sale_prices_all on public.product_sale_prices;
create policy product_sale_prices_all
on public.product_sale_prices
for all
to authenticated
using (public.is_org_member(organization_id))
with check (public.is_org_member(organization_id));

drop trigger if exists product_sale_prices_set_updated_at on public.product_sale_prices;
create trigger product_sale_prices_set_updated_at
before update on public.product_sale_prices
for each row execute function public.set_updated_at();

