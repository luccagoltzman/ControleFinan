import { supabase } from '../../app/supabaseClient'

export type Employee = {
  id: string
  organization_id: string
  name: string
  base_salary: number
  role_title: string | null
  pay_day: number | null
  is_active: boolean
  created_at: string
}

export type PayrollPeriod = {
  id: string
  organization_id: string
  month: string
  status: 'open' | 'closed'
  pay_date: string | null
  paid_at: string | null
  paid_by: string | null
  created_at: string
}

export type PayrollEntry = {
  id: string
  organization_id: string
  period_id: string
  employee_id: string
  type: 'earning' | 'deduction'
  description: string
  amount: number
  created_at: string
  employee?: { id: string; name: string } | null
}

export type PayrollEmployeePayment = {
  id: string
  organization_id: string
  period_id: string
  employee_id: string
  pay_date: string | null
  paid_at: string | null
  paid_by: string | null
  created_at: string
  updated_at: string
}

export async function fetchEmployees(organizationId: string): Promise<Employee[]> {
  const { data, error } = await supabase
    .from('employees')
    .select('id, organization_id, name, base_salary, role_title, pay_day, is_active, created_at')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: true })

  if (error) throw error
  return (data ?? []) as Employee[]
}

export async function createEmployee(input: {
  organization_id: string
  name: string
  base_salary: number
  role_title: string | null
  pay_day: number | null
}) {
  const { error } = await supabase.from('employees').insert({
    organization_id: input.organization_id,
    name: input.name,
    base_salary: input.base_salary,
    role_title: input.role_title,
    pay_day: input.pay_day,
  })
  if (error) throw error
}

export async function updateEmployee(input: {
  id: string
  organization_id: string
  name: string
  base_salary: number
  role_title: string | null
  pay_day: number | null
  is_active: boolean
}) {
  const { error } = await supabase
    .from('employees')
    .update({
      name: input.name,
      base_salary: input.base_salary,
      role_title: input.role_title,
      pay_day: input.pay_day,
      is_active: input.is_active,
    })
    .eq('id', input.id)
    .eq('organization_id', input.organization_id)

  if (error) throw error
}

export async function fetchPeriods(organizationId: string): Promise<PayrollPeriod[]> {
  const { data, error } = await supabase
    .from('payroll_periods')
    .select('id, organization_id, month, status, pay_date, paid_at, paid_by, created_at')
    .eq('organization_id', organizationId)
    .order('month', { ascending: false })
    .limit(24)

  if (error) throw error
  return (data ?? []) as PayrollPeriod[]
}

export async function createPeriod(input: { organization_id: string; month: string }) {
  const { data, error } = await supabase
    .from('payroll_periods')
    .insert({ organization_id: input.organization_id, month: input.month })
    .select('id')
    .single()
  if (error) throw error
  return { id: data.id as string }
}

export async function setPeriodStatus(input: {
  id: string
  organization_id: string
  status: 'open' | 'closed'
  pay_date?: string | null
  paid_at?: string | null
  paid_by?: string | null
}) {
  const { error } = await supabase
    .from('payroll_periods')
    .update({
      status: input.status,
      pay_date: input.pay_date ?? null,
      paid_at: input.paid_at ?? null,
      paid_by: input.paid_by ?? null,
    })
    .eq('id', input.id)
    .eq('organization_id', input.organization_id)

  if (error) throw error
}

export async function markPeriodAsPaid(input: {
  id: string
  organization_id: string
  pay_date: string
}) {
  const { data: userData } = await supabase.auth.getUser()
  const userId = userData.user?.id ?? null

  const { error } = await supabase
    .from('payroll_periods')
    .update({
      status: 'closed',
      pay_date: input.pay_date,
      paid_at: new Date().toISOString(),
      paid_by: userId,
    })
    .eq('id', input.id)
    .eq('organization_id', input.organization_id)

  if (error) throw error
}

export async function unmarkPeriodAsPaid(input: { id: string; organization_id: string }) {
  const { error } = await supabase
    .from('payroll_periods')
    .update({ status: 'open', pay_date: null, paid_at: null, paid_by: null })
    .eq('id', input.id)
    .eq('organization_id', input.organization_id)

  if (error) throw error
}

export async function fetchEntries(input: {
  organization_id: string
  period_id: string
}): Promise<PayrollEntry[]> {
  const { data, error } = await supabase
    .from('payroll_entries')
    .select('id, organization_id, period_id, employee_id, type, description, amount, created_at, employees ( id, name )')
    .eq('organization_id', input.organization_id)
    .eq('period_id', input.period_id)
    .order('created_at', { ascending: true })

  if (error) throw error

  return (data ?? []).map((row) => ({
    id: row.id as string,
    organization_id: row.organization_id as string,
    period_id: row.period_id as string,
    employee_id: row.employee_id as string,
    type: row.type as PayrollEntry['type'],
    description: row.description as string,
    amount: row.amount as number,
    created_at: row.created_at as string,
    employee: (row as unknown as { employees?: { id: string; name: string } | null }).employees ?? null,
  }))
}

export async function fetchEmployeePayments(input: {
  organization_id: string
  period_id: string
}): Promise<PayrollEmployeePayment[]> {
  const { data, error } = await supabase
    .from('payroll_employee_payments')
    .select('id, organization_id, period_id, employee_id, pay_date, paid_at, paid_by, created_at, updated_at')
    .eq('organization_id', input.organization_id)
    .eq('period_id', input.period_id)
    .order('updated_at', { ascending: false })

  if (error) throw error
  return (data ?? []) as PayrollEmployeePayment[]
}

export async function setEmployeePaid(input: {
  organization_id: string
  period_id: string
  employee_id: string
  is_paid: boolean
  pay_date: string | null
}) {
  const { data: userData } = await supabase.auth.getUser()
  const userId = userData.user?.id ?? null

  if (input.is_paid) {
    const { error } = await supabase.from('payroll_employee_payments').upsert(
      {
        organization_id: input.organization_id,
        period_id: input.period_id,
        employee_id: input.employee_id,
        pay_date: input.pay_date,
        paid_at: new Date().toISOString(),
        paid_by: userId,
      },
      { onConflict: 'period_id,employee_id' },
    )
    if (error) throw error
    return
  }

  const { error } = await supabase
    .from('payroll_employee_payments')
    .delete()
    .eq('organization_id', input.organization_id)
    .eq('period_id', input.period_id)
    .eq('employee_id', input.employee_id)

  if (error) throw error
}

export async function createEntry(input: {
  organization_id: string
  period_id: string
  employee_id: string
  type: 'earning' | 'deduction'
  description: string
  amount: number
}) {
  const { error } = await supabase.from('payroll_entries').insert({
    organization_id: input.organization_id,
    period_id: input.period_id,
    employee_id: input.employee_id,
    type: input.type,
    description: input.description,
    amount: input.amount,
  })
  if (error) throw error
}

