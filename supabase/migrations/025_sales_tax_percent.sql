-- Percentual do imposto sobre lucro+comissão (snapshot na 1ª linha do pedido).

alter table public.sales
  add column if not exists tax_percent_snapshot numeric(8, 4) null
    check (tax_percent_snapshot is null or (tax_percent_snapshot >= 0 and tax_percent_snapshot <= 100));

comment on column public.sales.tax_percent_snapshot is
  '% do imposto sobre lucro+comissão, gravado junto com tax_amount na 1ª linha do pedido.';
