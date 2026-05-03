-- Anexos de pedido/venda: NF e imagem/documento do pedido do cliente (arquivos no Storage)

-- Bucket privado (acesso via signed URL + políticas por pasta da organização)
insert into storage.buckets (id, name, public, file_size_limit)
values ('sale-attachments', 'sale-attachments', false, 52428800)
on conflict (id) do update set file_size_limit = excluded.file_size_limit;

create table if not exists public.sale_attachments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  sale_id uuid not null references public.sales(id) on delete cascade,
  kind text not null check (kind in ('nf', 'customer_order')),
  storage_path text not null,
  file_name text not null,
  mime_type text null,
  size_bytes bigint null check (size_bytes is null or size_bytes >= 0),
  created_at timestamptz not null default now(),
  unique (sale_id, storage_path)
);

create index if not exists sale_attachments_org_id_idx on public.sale_attachments(organization_id);
create index if not exists sale_attachments_sale_id_idx on public.sale_attachments(sale_id);

alter table public.sale_attachments enable row level security;

drop policy if exists "sale_attachments_all" on public.sale_attachments;

create policy "sale_attachments_all"
  on public.sale_attachments
  for all
  to authenticated
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

-- Storage: primeiro segmento do path = organization_id (uuid)
drop policy if exists "sale_attachments_storage_select" on storage.objects;
drop policy if exists "sale_attachments_storage_insert" on storage.objects;
drop policy if exists "sale_attachments_storage_update" on storage.objects;
drop policy if exists "sale_attachments_storage_delete" on storage.objects;

create policy "sale_attachments_storage_select"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'sale-attachments'
    and split_part(name, '/', 1)::uuid in (
      select organization_id from public.organization_members where user_id = auth.uid()
    )
  );

create policy "sale_attachments_storage_insert"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'sale-attachments'
    and split_part(name, '/', 1)::uuid in (
      select organization_id from public.organization_members where user_id = auth.uid()
    )
  );

create policy "sale_attachments_storage_update"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'sale-attachments'
    and split_part(name, '/', 1)::uuid in (
      select organization_id from public.organization_members where user_id = auth.uid()
    )
  );

create policy "sale_attachments_storage_delete"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'sale-attachments'
    and split_part(name, '/', 1)::uuid in (
      select organization_id from public.organization_members where user_id = auth.uid()
    )
  );
