-- Gestão de membros por e-mail (somente owner/admin)

create or replace function public.add_org_member_by_email(
  org_id uuid,
  member_email text,
  member_role text default 'member'
)
returns void
language plpgsql
security definer
set search_path = public, auth
set row_security = off
as $$
declare
  target_user_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if member_email is null or length(trim(member_email)) = 0 then
    raise exception 'Email is required';
  end if;

  if member_role not in ('admin', 'member') then
    raise exception 'Role must be admin or member';
  end if;

  if not exists (
    select 1
    from public.organization_members m
    where m.organization_id = org_id
      and m.user_id = auth.uid()
      and m.role in ('owner', 'admin')
  ) then
    raise exception 'Only owner/admin can add members';
  end if;

  select u.id
    into target_user_id
  from auth.users u
  where lower(u.email) = lower(trim(member_email))
  limit 1;

  if target_user_id is null then
    raise exception 'User not found for this email';
  end if;

  insert into public.organization_members(organization_id, user_id, role)
  values (org_id, target_user_id, member_role)
  on conflict (organization_id, user_id) do update set role = excluded.role;
end;
$$;

revoke all on function public.add_org_member_by_email(uuid, text, text) from public;
grant execute on function public.add_org_member_by_email(uuid, text, text) to authenticated;

create or replace function public.remove_org_member(
  org_id uuid,
  member_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  requester_role text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select m.role into requester_role
  from public.organization_members m
  where m.organization_id = org_id
    and m.user_id = auth.uid()
  limit 1;

  if requester_role is null then
    raise exception 'Not a member of this organization';
  end if;

  -- somente owner/admin; admin não remove owner
  if requester_role not in ('owner', 'admin') then
    raise exception 'Only owner/admin can remove members';
  end if;

  if requester_role = 'admin' and exists (
    select 1 from public.organization_members m
    where m.organization_id = org_id
      and m.user_id = member_user_id
      and m.role = 'owner'
  ) then
    raise exception 'Admin cannot remove owner';
  end if;

  delete from public.organization_members m
  where m.organization_id = org_id
    and m.user_id = member_user_id;
end;
$$;

revoke all on function public.remove_org_member(uuid, uuid) from public;
grant execute on function public.remove_org_member(uuid, uuid) to authenticated;

