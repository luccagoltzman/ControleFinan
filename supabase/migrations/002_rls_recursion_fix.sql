-- Corrige recursão de RLS (stack depth exceeded) em funções/policies

-- 1) Função helper precisa bypassar RLS para não recursar
create or replace function public.is_org_member(org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select exists (
    select 1
    from public.organization_members m
    where m.organization_id = org_id
      and m.user_id = auth.uid()
  );
$$;

revoke all on function public.is_org_member(uuid) from public;
grant execute on function public.is_org_member(uuid) to authenticated;

-- 2) RPC de onboarding também deve bypassar RLS
create or replace function public.create_organization_for_user(org_name text)
returns uuid
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  new_org_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  insert into public.organizations(name)
  values (org_name)
  returning id into new_org_id;

  insert into public.organization_members(organization_id, user_id, role)
  values (new_org_id, auth.uid(), 'owner')
  on conflict do nothing;

  return new_org_id;
end;
$$;

revoke all on function public.create_organization_for_user(text) from public;
grant execute on function public.create_organization_for_user(text) to authenticated;

