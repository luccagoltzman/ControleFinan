-- Vários produtos por pedido: linhas de `sales` com o mesmo `order_id` pertencem ao mesmo lançamento.

alter table public.sales add column if not exists order_id uuid null;

create index if not exists sales_org_order_id_idx
  on public.sales (organization_id, order_id)
  where order_id is not null;

comment on column public.sales.order_id is 'Identificador do pedido; várias linhas partilham o mesmo valor. NULL = lançamento único (legado ou linha isolada).';
