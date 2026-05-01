-- Regras de preço por unidade (kg/un) por produto

-- 1) Adiciona coluna unit
alter table public.product_pricing_rules
  add column if not exists unit text not null default 'kg'
  check (unit in ('kg', 'un'));

-- 2) Remove unique antigo (product_id) e cria unique novo (product_id, unit)
do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'product_pricing_rules_product_id_key'
      and conrelid = 'public.product_pricing_rules'::regclass
  ) then
    alter table public.product_pricing_rules drop constraint product_pricing_rules_product_id_key;
  end if;
end $$;

create unique index if not exists product_pricing_rules_product_id_unit_key
  on public.product_pricing_rules(product_id, unit);

