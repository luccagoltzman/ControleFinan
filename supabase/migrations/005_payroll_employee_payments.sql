-- Checklist de pagamento por funcionário (por mês/período)

create table if not exists public.payroll_employee_payments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  period_id uuid not null references public.payroll_periods(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  pay_date date null,
  paid_at timestamptz null,
  paid_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (period_id, employee_id)
);

create index if not exists payroll_employee_payments_org_id_idx
  on public.payroll_employee_payments(organization_id);
create index if not exists payroll_employee_payments_period_id_idx
  on public.payroll_employee_payments(period_id);
create index if not exists payroll_employee_payments_employee_id_idx
  on public.payroll_employee_payments(employee_id);

alter table public.payroll_employee_payments enable row level security;

drop policy if exists payroll_employee_payments_all on public.payroll_employee_payments;
create policy payroll_employee_payments_all
on public.payroll_employee_payments
for all
to authenticated
using (public.is_org_member(organization_id))
with check (public.is_org_member(organization_id));

drop trigger if exists payroll_employee_payments_set_updated_at on public.payroll_employee_payments;
create trigger payroll_employee_payments_set_updated_at
before update on public.payroll_employee_payments
for each row execute function public.set_updated_at();

