-- Segunda região (CD) no mesmo pedido/venda

alter table public.sales
  add column if not exists region_id_2 uuid null references public.regions(id) on delete set null;

create index if not exists sales_region_id_2_idx on public.sales(region_id_2);

comment on column public.sales.region_id_2 is 'Segunda região/CD do mesmo pedido (opcional).';
