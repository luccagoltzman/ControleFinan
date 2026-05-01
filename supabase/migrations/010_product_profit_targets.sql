-- Alvo de lucro por produto e unidade (kg/un)

create table if not exists public.product_profit_targets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  unit text not null check (unit in ('kg','un')),
  -- valor em R$ (ex.: 0,50 significa "quero ganhar 50 centavos por unidade/kg")
  target_profit_amount numeric(12,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(product_id, unit)
);

alter table public.product_profit_targets enable row level security;

create policy "profit_targets_select_own_org"
  on public.product_profit_targets
  for select
  using (is_org_member(organization_id));

create policy "profit_targets_insert_own_org"
  on public.product_profit_targets
  for insert
  with check (is_org_member(organization_id));

create policy "profit_targets_update_own_org"
  on public.product_profit_targets
  for update
  using (is_org_member(organization_id))
  with check (is_org_member(organization_id));

create policy "profit_targets_delete_own_org"
  on public.product_profit_targets
  for delete
  using (is_org_member(organization_id));

create index if not exists product_profit_targets_org_id_idx on public.product_profit_targets(organization_id);
create index if not exists product_profit_targets_product_id_idx on public.product_profit_targets(product_id);

