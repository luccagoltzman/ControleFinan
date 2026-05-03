-- Identidade visual da organização: cor da marca e logo (Storage público)

alter table public.organizations
  add column if not exists brand_color text null;

alter table public.organizations
  add column if not exists logo_storage_path text null;

alter table public.organizations
  add column if not exists branding_updated_at timestamptz not null default now();

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'organizations' and column_name = 'brand_color'
  ) then
    alter table public.organizations drop constraint if exists organizations_brand_color_format;
    alter table public.organizations
      add constraint organizations_brand_color_format
      check (brand_color is null or brand_color ~ '^#[0-9A-Fa-f]{6}$');
  end if;
end $$;

-- Bucket público: logos acessíveis por URL sem token (path = {organization_id}/...)
insert into storage.buckets (id, name, public, file_size_limit)
values ('org-assets', 'org-assets', true, 2097152)
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit;

drop policy if exists "org_assets_storage_select" on storage.objects;
drop policy if exists "org_assets_storage_insert" on storage.objects;
drop policy if exists "org_assets_storage_update" on storage.objects;
drop policy if exists "org_assets_storage_delete" on storage.objects;

-- Leitura pública (URLs /object/public/org-assets/...)
create policy "org_assets_storage_select"
  on storage.objects
  for select
  to anon, authenticated
  using (bucket_id = 'org-assets');

create policy "org_assets_storage_insert"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'org-assets'
    and split_part(name, '/', 1)::uuid in (
      select organization_id from public.organization_members where user_id = auth.uid()
    )
  );

create policy "org_assets_storage_update"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'org-assets'
    and split_part(name, '/', 1)::uuid in (
      select organization_id from public.organization_members where user_id = auth.uid()
    )
  );

create policy "org_assets_storage_delete"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'org-assets'
    and split_part(name, '/', 1)::uuid in (
      select organization_id from public.organization_members where user_id = auth.uid()
    )
  );
