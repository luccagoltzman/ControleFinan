-- Despesas avulsas: controlo independente de faturamento/lucro; opcional divisão 50/50 com sócio

create table if not exists public.misc_expenses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  spent_at timestamptz not null,
  amount numeric(12, 2) not null check (amount >= 0),
  description text not null default '',
  split_with_partner boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists misc_expenses_org_spent_at_idx
  on public.misc_expenses (organization_id, spent_at desc);

alter table public.misc_expenses enable row level security;

drop policy if exists misc_expenses_all on public.misc_expenses;

create policy misc_expenses_all
  on public.misc_expenses
  for all
  to authenticated
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));
