-- Folha (extensões): cargo/função e dia de pagamento; baixa mensal do pagamento

alter table public.employees
  add column if not exists role_title text null,
  add column if not exists pay_day int null check (pay_day between 1 and 31);

alter table public.payroll_periods
  add column if not exists pay_date date null,
  add column if not exists paid_at timestamptz null,
  add column if not exists paid_by uuid null references auth.users(id) on delete set null;

create index if not exists payroll_periods_paid_at_idx on public.payroll_periods(paid_at desc);

