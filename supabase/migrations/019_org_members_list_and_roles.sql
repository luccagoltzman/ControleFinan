-- Lista de membros (com e-mail) e atualização de papel admin/member.

create or replace function public.list_org_members(org_id uuid)
returns table (user_id uuid, email text, role text, created_at timestamptz)
language sql
stable
security definer
set search_path = public, auth
set row_security = off
as $$
  select
    m.user_id,
    coalesce(u.email, '')::text as email,
    m.role::text,
    m.created_at
  from public.organization_members m
  join auth.users u on u.id = m.user_id
  where m.organization_id = org_id
    and auth.uid() is not null
    and public.is_org_member(org_id)
  order by
    case m.role
      when 'owner' then 0
      when 'admin' then 1
      else 2
    end,
    u.email asc;
$$;

revoke all on function public.list_org_members(uuid) from public;
grant execute on function public.list_org_members(uuid) to authenticated;

create or replace function public.update_org_member_role(
  org_id uuid,
  member_user_id uuid,
  new_role text
)
returns void
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  requester_role text;
  target_role text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if new_role not in ('admin', 'member') then
    raise exception 'Role must be admin or member';
  end if;

  select m.role into requester_role
  from public.organization_members m
  where m.organization_id = org_id
    and m.user_id = auth.uid()
  limit 1;

  if requester_role is null then
    raise exception 'Not a member of this organization';
  end if;

  if requester_role not in ('owner', 'admin') then
    raise exception 'Only owner/admin can update roles';
  end if;

  select m.role into target_role
  from public.organization_members m
  where m.organization_id = org_id
    and m.user_id = member_user_id
  limit 1;

  if target_role is null then
    raise exception 'Member not found';
  end if;

  if target_role = 'owner' then
    raise exception 'Cannot change owner role here';
  end if;

  update public.organization_members m
  set role = new_role
  where m.organization_id = org_id
    and m.user_id = member_user_id;
end;
$$;

revoke all on function public.update_org_member_role(uuid, uuid, text) from public;
grant execute on function public.update_org_member_role(uuid, uuid, text) to authenticated;
