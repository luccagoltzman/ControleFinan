-- Suporte a venda em kg ou unidade (un) por venda
-- - custo pode ser cadastrado por kg ou por unidade
-- - produto pode ter peso médio por unidade (kg por un) para conversão

-- 1) Products: peso médio por unidade (kg por un)
alter table public.products
  add column if not exists weight_per_unit_kg numeric(12, 6) null
  check (weight_per_unit_kg is null or weight_per_unit_kg > 0);

-- 2) Product costs: unidade do custo
alter table public.product_costs
  add column if not exists unit text not null default 'kg'
  check (unit in ('kg', 'un'));

create index if not exists product_costs_product_id_unit_effective_date_idx
  on public.product_costs(product_id, unit, effective_date desc);

-- 3) Sales: unidade da quantidade/preço
alter table public.sales
  add column if not exists qty_unit text not null default 'kg'
  check (qty_unit in ('kg', 'un'));

create index if not exists sales_qty_unit_idx on public.sales(qty_unit);

