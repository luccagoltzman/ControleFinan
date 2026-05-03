-- Comissão do representante: % sobre o valor total do pedido (receita da venda)
-- Padrão na organização; opcional por produto (sobrescreve o padrão)

alter table public.organizations
  add column if not exists default_commission_percent numeric(7,4) null;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'organizations' and column_name = 'default_commission_percent'
  ) then
    alter table public.organizations drop constraint if exists organizations_default_commission_percent_check;
    alter table public.organizations
      add constraint organizations_default_commission_percent_check
      check (default_commission_percent is null or (default_commission_percent >= 0 and default_commission_percent <= 100));
  end if;
end $$;

alter table public.products
  add column if not exists commission_percent numeric(7,4) null;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'products' and column_name = 'commission_percent'
  ) then
    alter table public.products drop constraint if exists products_commission_percent_check;
    alter table public.products
      add constraint products_commission_percent_check
      check (commission_percent is null or (commission_percent >= 0 and commission_percent <= 100));
  end if;
end $$;

alter table public.sales
  add column if not exists commission_percent_snapshot numeric(7,4) not null default 0;

alter table public.sales
  add column if not exists commission_amount numeric(12,2) not null default 0;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'sales' and column_name = 'commission_percent_snapshot'
  ) then
    alter table public.sales drop constraint if exists sales_commission_percent_snapshot_check;
    alter table public.sales
      add constraint sales_commission_percent_snapshot_check
      check (commission_percent_snapshot >= 0 and commission_percent_snapshot <= 100);
  end if;
end $$;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'sales' and column_name = 'commission_amount'
  ) then
    alter table public.sales drop constraint if exists sales_commission_amount_check;
    alter table public.sales
      add constraint sales_commission_amount_check
      check (commission_amount >= 0);
  end if;
end $$;
