-- Status de pagamento do pedido; gravado na primeira linha do order_id.

alter table public.sales
  add column if not exists payment_status text not null default 'pending'
    check (payment_status in ('pending', 'paid'));

alter table public.sales
  add column if not exists paid_at timestamptz null;

comment on column public.sales.payment_status is
  'Situação de pagamento do pedido; preenchido na primeira linha do order_id.';
comment on column public.sales.paid_at is
  'Data/hora em que o pedido foi marcado como pago.';
