-- Imposto informado sobre (lucro + comissão) do pedido; gravado na primeira linha do pedido.

alter table public.sales
  add column if not exists tax_amount numeric(12, 2) null check (tax_amount is null or tax_amount >= 0);

comment on column public.sales.tax_amount is
  'Valor de imposto sobre lucro+comissão do pedido; preenchido na primeira linha do order_id.';
