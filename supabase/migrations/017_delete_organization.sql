-- Exclusão de organização (somente owner)
-- Observação: remove registros via ON DELETE CASCADE (tabelas com FK para organizations).

create or replace function public.delete_organization(org_id uuid)
returns void
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if not exists (
    select 1
    from public.organization_members m
    where m.organization_id = org_id
      and m.user_id = auth.uid()
      and m.role = 'owner'
  ) then
    raise exception 'Only the organization owner can delete this organization';
  end if;

  delete from public.organizations o
  where o.id = org_id;
end;
$$;

revoke all on function public.delete_organization(uuid) from public;
grant execute on function public.delete_organization(uuid) to authenticated;

