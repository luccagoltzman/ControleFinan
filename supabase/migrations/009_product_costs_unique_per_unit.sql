-- Corrige UNIQUE de product_costs para suportar kg/un no mesmo dia
-- Necessário para ON CONFLICT (product_id, unit, effective_date)

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'product_costs_product_id_effective_date_key'
      and conrelid = 'public.product_costs'::regclass
  ) then
    alter table public.product_costs drop constraint product_costs_product_id_effective_date_key;
  end if;
exception
  when undefined_table then
    -- tabela ainda não existe; ignore
    null;
end $$;

create unique index if not exists product_costs_product_id_unit_effective_date_key
  on public.product_costs(product_id, unit, effective_date);

