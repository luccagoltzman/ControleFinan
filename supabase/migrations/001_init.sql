-- ControleFinan: schema inicial (multi-tenant) + RLS

-- Extensions
create extension if not exists pgcrypto;

-- Enums via CHECK para simplicidade

-- Organizations
create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'member')),
  created_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

create index if not exists organization_members_user_id_idx
  on public.organization_members(user_id);
create index if not exists organization_members_org_id_idx
  on public.organization_members(organization_id);

-- Produtos
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  unit text not null default 'kg',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (organization_id, name)
);

create index if not exists products_org_id_idx on public.products(organization_id);

create table if not exists public.product_costs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  cost numeric(12, 2) not null check (cost >= 0),
  effective_date date not null default current_date,
  created_at timestamptz not null default now(),
  unique (product_id, effective_date)
);

create index if not exists product_costs_product_id_idx on public.product_costs(product_id);
create index if not exists product_costs_org_id_idx on public.product_costs(organization_id);

create table if not exists public.product_pricing_rules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  mode text not null check (mode in ('markup', 'target_margin', 'both')),
  markup_percent numeric(7, 4) null check (markup_percent is null or markup_percent >= 0),
  target_margin_percent numeric(7, 4) null check (
    target_margin_percent is null or (target_margin_percent >= 0 and target_margin_percent < 1)
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id)
);

create index if not exists product_pricing_rules_product_id_idx on public.product_pricing_rules(product_id);
create index if not exists product_pricing_rules_org_id_idx on public.product_pricing_rules(organization_id);

-- Folha salarial
create table if not exists public.employees (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  base_salary numeric(12, 2) not null default 0 check (base_salary >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (organization_id, name)
);

create index if not exists employees_org_id_idx on public.employees(organization_id);

create table if not exists public.payroll_periods (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  month date not null,
  status text not null default 'open' check (status in ('open', 'closed')),
  created_at timestamptz not null default now(),
  unique (organization_id, month)
);

create index if not exists payroll_periods_org_id_idx on public.payroll_periods(organization_id);

create table if not exists public.payroll_entries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  period_id uuid not null references public.payroll_periods(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  type text not null check (type in ('earning', 'deduction')),
  description text not null,
  amount numeric(12, 2) not null check (amount >= 0),
  created_at timestamptz not null default now()
);

create index if not exists payroll_entries_org_id_idx on public.payroll_entries(organization_id);
create index if not exists payroll_entries_period_id_idx on public.payroll_entries(period_id);
create index if not exists payroll_entries_employee_id_idx on public.payroll_entries(employee_id);

-- Updated_at trigger
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists product_pricing_rules_set_updated_at on public.product_pricing_rules;
create trigger product_pricing_rules_set_updated_at
before update on public.product_pricing_rules
for each row execute function public.set_updated_at();

-- RLS helpers
create or replace function public.is_org_member(org_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.organization_members m
    where m.organization_id = org_id
      and m.user_id = auth.uid()
  );
$$;

-- Enable RLS
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.products enable row level security;
alter table public.product_costs enable row level security;
alter table public.product_pricing_rules enable row level security;
alter table public.employees enable row level security;
alter table public.payroll_periods enable row level security;
alter table public.payroll_entries enable row level security;

-- Organizations policies
drop policy if exists organizations_select on public.organizations;
create policy organizations_select
on public.organizations
for select
to authenticated
using (public.is_org_member(id));

drop policy if exists organizations_insert on public.organizations;
create policy organizations_insert
on public.organizations
for insert
to authenticated
with check (true);

drop policy if exists organizations_update on public.organizations;
create policy organizations_update
on public.organizations
for update
to authenticated
using (public.is_org_member(id))
with check (public.is_org_member(id));

drop policy if exists organizations_delete on public.organizations;
create policy organizations_delete
on public.organizations
for delete
to authenticated
using (false);

-- Organization members policies
drop policy if exists organization_members_select on public.organization_members;
create policy organization_members_select
on public.organization_members
for select
to authenticated
using (public.is_org_member(organization_id));

drop policy if exists organization_members_insert on public.organization_members;
create policy organization_members_insert
on public.organization_members
for insert
to authenticated
with check (public.is_org_member(organization_id));

drop policy if exists organization_members_update on public.organization_members;
create policy organization_members_update
on public.organization_members
for update
to authenticated
using (public.is_org_member(organization_id))
with check (public.is_org_member(organization_id));

drop policy if exists organization_members_delete on public.organization_members;
create policy organization_members_delete
on public.organization_members
for delete
to authenticated
using (public.is_org_member(organization_id));

-- Generic per-table policies (organization_id)
-- Products
drop policy if exists products_all on public.products;
create policy products_all
on public.products
for all
to authenticated
using (public.is_org_member(organization_id))
with check (public.is_org_member(organization_id));

-- Product costs
drop policy if exists product_costs_all on public.product_costs;
create policy product_costs_all
on public.product_costs
for all
to authenticated
using (public.is_org_member(organization_id))
with check (public.is_org_member(organization_id));

-- Pricing rules
drop policy if exists product_pricing_rules_all on public.product_pricing_rules;
create policy product_pricing_rules_all
on public.product_pricing_rules
for all
to authenticated
using (public.is_org_member(organization_id))
with check (public.is_org_member(organization_id));

-- Employees
drop policy if exists employees_all on public.employees;
create policy employees_all
on public.employees
for all
to authenticated
using (public.is_org_member(organization_id))
with check (public.is_org_member(organization_id));

-- Payroll periods
drop policy if exists payroll_periods_all on public.payroll_periods;
create policy payroll_periods_all
on public.payroll_periods
for all
to authenticated
using (public.is_org_member(organization_id))
with check (public.is_org_member(organization_id));

-- Payroll entries
drop policy if exists payroll_entries_all on public.payroll_entries;
create policy payroll_entries_all
on public.payroll_entries
for all
to authenticated
using (public.is_org_member(organization_id))
with check (public.is_org_member(organization_id));

-- Onboarding RPC: cria organização e adiciona membro owner
create or replace function public.create_organization_for_user(org_name text)
returns uuid
language plpgsql
security definer
set search_path = public
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

