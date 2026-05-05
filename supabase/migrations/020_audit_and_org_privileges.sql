-- Auditoria (append-only) + RLS: folha salarial e despesas apenas owner/admin.

create or replace function public.is_org_owner_or_admin(org_id uuid)
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
      and m.role in ('owner', 'admin')
  );
$$;

revoke all on function public.is_org_owner_or_admin(uuid) from public;
grant execute on function public.is_org_owner_or_admin(uuid) to authenticated;

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid null references auth.users(id) on delete set null,
  actor_email text null,
  action text not null,
  entity_type text not null,
  entity_id text null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_logs_org_created_idx
  on public.audit_logs (organization_id, created_at desc);

alter table public.audit_logs enable row level security;

drop policy if exists audit_logs_select on public.audit_logs;
create policy audit_logs_select
  on public.audit_logs
  for select
  to authenticated
  using (public.is_org_owner_or_admin(organization_id));

revoke all on public.audit_logs from public;
grant select on public.audit_logs to authenticated;

create or replace function public.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = public, auth
set row_security = off
as $$
declare
  org uuid;
  eid text;
  uid uuid := auth.uid();
  mail text;
  act text;
begin
  if tg_table_name = 'organizations' then
    org := new.id;
    eid := new.id::text;
  elsif tg_op = 'DELETE' then
    org := old.organization_id;
    eid := old.id::text;
  else
    org := new.organization_id;
    eid := new.id::text;
  end if;

  act := lower(tg_op) || '.' || tg_table_name;

  if uid is not null then
    select u.email::text into mail from auth.users u where u.id = uid limit 1;
  end if;

  insert into public.audit_logs (organization_id, user_id, actor_email, action, entity_type, entity_id)
  values (org, uid, mail, act, tg_table_name, eid);

  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_audit_organizations on public.organizations;
create trigger trg_audit_organizations
after insert or update on public.organizations
for each row execute function public.audit_row_change();

drop trigger if exists trg_audit_organization_members on public.organization_members;
create trigger trg_audit_organization_members
after insert or update or delete on public.organization_members
for each row execute function public.audit_row_change();

drop trigger if exists trg_audit_products on public.products;
create trigger trg_audit_products
after insert or update or delete on public.products
for each row execute function public.audit_row_change();

drop trigger if exists trg_audit_product_costs on public.product_costs;
create trigger trg_audit_product_costs
after insert or update or delete on public.product_costs
for each row execute function public.audit_row_change();

drop trigger if exists trg_audit_product_pricing_rules on public.product_pricing_rules;
create trigger trg_audit_product_pricing_rules
after insert or update or delete on public.product_pricing_rules
for each row execute function public.audit_row_change();

drop trigger if exists trg_audit_employees on public.employees;
create trigger trg_audit_employees
after insert or update or delete on public.employees
for each row execute function public.audit_row_change();

drop trigger if exists trg_audit_payroll_periods on public.payroll_periods;
create trigger trg_audit_payroll_periods
after insert or update or delete on public.payroll_periods
for each row execute function public.audit_row_change();

drop trigger if exists trg_audit_payroll_entries on public.payroll_entries;
create trigger trg_audit_payroll_entries
after insert or update or delete on public.payroll_entries
for each row execute function public.audit_row_change();

drop trigger if exists trg_audit_payroll_employee_payments on public.payroll_employee_payments;
create trigger trg_audit_payroll_employee_payments
after insert or update or delete on public.payroll_employee_payments
for each row execute function public.audit_row_change();

drop trigger if exists trg_audit_misc_expenses on public.misc_expenses;
create trigger trg_audit_misc_expenses
after insert or update or delete on public.misc_expenses
for each row execute function public.audit_row_change();

drop trigger if exists trg_audit_sales on public.sales;
create trigger trg_audit_sales
after insert or update or delete on public.sales
for each row execute function public.audit_row_change();

drop trigger if exists trg_audit_regions on public.regions;
create trigger trg_audit_regions
after insert or update or delete on public.regions
for each row execute function public.audit_row_change();

drop trigger if exists trg_audit_product_sale_prices on public.product_sale_prices;
create trigger trg_audit_product_sale_prices
after insert or update or delete on public.product_sale_prices
for each row execute function public.audit_row_change();

drop trigger if exists trg_audit_product_profit_targets on public.product_profit_targets;
create trigger trg_audit_product_profit_targets
after insert or update or delete on public.product_profit_targets
for each row execute function public.audit_row_change();

drop trigger if exists trg_audit_sale_attachments on public.sale_attachments;
create trigger trg_audit_sale_attachments
after insert or update or delete on public.sale_attachments
for each row execute function public.audit_row_change();

-- Folha + despesas: somente owner/admin (membros comuns não acessam)

drop policy if exists employees_all on public.employees;
create policy employees_all
on public.employees
for all
to authenticated
using (public.is_org_owner_or_admin(organization_id))
with check (public.is_org_owner_or_admin(organization_id));

drop policy if exists payroll_periods_all on public.payroll_periods;
create policy payroll_periods_all
on public.payroll_periods
for all
to authenticated
using (public.is_org_owner_or_admin(organization_id))
with check (public.is_org_owner_or_admin(organization_id));

drop policy if exists payroll_entries_all on public.payroll_entries;
create policy payroll_entries_all
on public.payroll_entries
for all
to authenticated
using (public.is_org_owner_or_admin(organization_id))
with check (public.is_org_owner_or_admin(organization_id));

drop policy if exists payroll_employee_payments_all on public.payroll_employee_payments;
create policy payroll_employee_payments_all
on public.payroll_employee_payments
for all
to authenticated
using (public.is_org_owner_or_admin(organization_id))
with check (public.is_org_owner_or_admin(organization_id));

drop policy if exists misc_expenses_all on public.misc_expenses;
create policy misc_expenses_all
on public.misc_expenses
for all
to authenticated
using (public.is_org_owner_or_admin(organization_id))
with check (public.is_org_owner_or_admin(organization_id));
