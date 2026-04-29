import { PageHeader } from '../../components/PageHeader'
import { useMutation, useQuery } from '@tanstack/react-query'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { useOrg } from '../../app/org/useOrg'
import { queryClient } from '../../app/queryClient'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { MoneyInput } from '../../components/inputs/MoneyInput'
import { formatMoney, parseMoneyPtBr } from '../../lib/money'
import type { ChangeEvent } from 'react'
import {
  createEmployee,
  createEntry,
  createPeriod,
  fetchEmployees,
  fetchEmployeePayments,
  fetchEntries,
  fetchPeriods,
  setEmployeePaid,
  setPeriodStatus,
  type Employee,
  type PayrollEmployeePayment,
  type PayrollEntry,
  updateEmployee,
} from './payrollApi'

const CreateEmployeeSchema = z.object({
  name: z.string().min(2, 'Informe um nome'),
  base_salary: z.string().optional(),
  role_title: z.string().optional(),
  pay_day: z.string().optional(),
})

type CreateEmployeeValues = z.infer<typeof CreateEmployeeSchema>

export function PayrollPage() {
  const { activeOrgId } = useOrg()
  const [selectedPeriodId, setSelectedPeriodId] = useState<string | null>(null)
  const [periodMonth, setPeriodMonth] = useState(() => new Date().toISOString().slice(0, 7))
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const employeesQuery = useQuery({
    queryKey: ['payroll', 'employees', { org: activeOrgId }],
    queryFn: () => fetchEmployees(activeOrgId!),
    enabled: !!activeOrgId,
  })

  const periodsQuery = useQuery({
    queryKey: ['payroll', 'periods', { org: activeOrgId }],
    queryFn: () => fetchPeriods(activeOrgId!),
    enabled: !!activeOrgId,
  })

  const entriesQuery = useQuery({
    queryKey: ['payroll', 'entries', { org: activeOrgId, period: selectedPeriodId }],
    queryFn: () => fetchEntries({ organization_id: activeOrgId!, period_id: selectedPeriodId! }),
    enabled: !!activeOrgId && !!selectedPeriodId,
  })

  const createEmployeeMutation = useMutation({
    mutationFn: (input: {
      name: string
      base_salary: number
      role_title: string | null
      pay_day: number | null
    }) => createEmployee({ organization_id: activeOrgId!, ...input }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['payroll', 'employees'] })
    },
  })

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateEmployeeValues>({ resolver: zodResolver(CreateEmployeeSchema) })

  async function onCreateEmployee(values: CreateEmployeeValues) {
    setErrorMsg(null)
    const salary = values.base_salary ? parseMoneyPtBr(values.base_salary) : 0
    if (salary == null) {
      setErrorMsg('Salário base inválido')
      return
    }
    const payDayRaw = values.pay_day?.trim() ? Number(values.pay_day) : null
    if (payDayRaw != null && (!Number.isInteger(payDayRaw) || payDayRaw < 1 || payDayRaw > 31)) {
      setErrorMsg('Dia de pagamento inválido (1 a 31)')
      return
    }
    try {
      await createEmployeeMutation.mutateAsync({
        name: values.name,
        base_salary: salary,
        role_title: values.role_title?.trim() ? values.role_title.trim() : null,
        pay_day: payDayRaw,
      })
      reset({ name: '', base_salary: '', role_title: '', pay_day: '' })
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Erro ao criar colaborador')
    }
  }

  const createPeriodMutation = useMutation({
    mutationFn: (input: { month: string }) =>
      createPeriod({ organization_id: activeOrgId!, month: `${input.month}-01` }),
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: ['payroll', 'periods'] })
      setSelectedPeriodId(data.id)
    },
  })

  const setStatusMutation = useMutation({
    mutationFn: (input: { id: string; status: 'open' | 'closed' }) =>
      setPeriodStatus({ organization_id: activeOrgId!, ...input }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['payroll', 'periods'] })
    },
  })

  const paymentsQuery = useQuery({
    queryKey: ['payroll', 'payments', { org: activeOrgId, period: selectedPeriodId }],
    queryFn: () =>
      fetchEmployeePayments({ organization_id: activeOrgId!, period_id: selectedPeriodId! }),
    enabled: !!activeOrgId && !!selectedPeriodId,
  })

  const payMutation = useMutation({
    mutationFn: (input: { employee_id: string; is_paid: boolean; pay_date: string | null }) =>
      setEmployeePaid({
        organization_id: activeOrgId!,
        period_id: selectedPeriodId!,
        employee_id: input.employee_id,
        is_paid: input.is_paid,
        pay_date: input.pay_date,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['payroll', 'payments'] })
    },
  })

  const createEntryMutation = useMutation({
    mutationFn: (input: {
      employee_id: string
      type: 'earning' | 'deduction'
      description: string
      amount: number
    }) =>
      createEntry({
        organization_id: activeOrgId!,
        period_id: selectedPeriodId!,
        ...input,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['payroll', 'entries'] })
    },
  })

  const periods = periodsQuery.data ?? []
  const employees = employeesQuery.data ?? []
  const selectedPeriod = periods.find((p) => p.id === selectedPeriodId) ?? null
  const [payDate, setPayDate] = useState(() => new Date().toISOString().slice(0, 10))

  const paymentsByEmployee = useMemo(() => {
    const map = new Map<string, PayrollEmployeePayment>()
    for (const p of paymentsQuery.data ?? []) map.set(p.employee_id, p)
    return map
  }, [paymentsQuery.data])

  const periodTotals = useMemo(() => {
    const entries = entriesQuery.data ?? []
    const byEmployee = new Map<string, { earnings: number; deductions: number }>()
    for (const e of entries) {
      const current = byEmployee.get(e.employee_id) ?? { earnings: 0, deductions: 0 }
      if (e.type === 'earning') current.earnings += e.amount
      else current.deductions += e.amount
      byEmployee.set(e.employee_id, current)
    }
    return { entries, byEmployee }
  }, [entriesQuery.data])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Folha salarial"
        description="Colaboradores, períodos mensais e lançamentos de proventos/descontos."
      />

      <Card>
        <CardHeader>
          <CardTitle>Colaboradores</CardTitle>
        </CardHeader>
        <CardContent>

        <form onSubmit={handleSubmit(onCreateEmployee)} className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <div className="sm:col-span-2">
            <Input placeholder="Nome" {...register('name')} />
            {errors.name ? <div className="mt-1 text-xs text-destructive">{errors.name.message}</div> : null}
          </div>
          <div>
            <MoneyInput label="Salário base (opcional)" {...register('base_salary')} />
          </div>
          <div>
            <label className="block">
              <div className="mb-1 text-sm font-medium text-muted-foreground">Função (opcional)</div>
              <Input placeholder="Ex.: Vendedor" {...register('role_title')} />
            </label>
          </div>
          <div>
            <label className="block">
              <div className="mb-1 text-sm font-medium text-muted-foreground">Dia do pagamento (1–31)</div>
              <Input inputMode="numeric" placeholder="Ex.: 5" {...register('pay_day')} />
            </label>
          </div>
          <div className="sm:col-span-3 flex items-center gap-2">
            <Button type="submit" disabled={isSubmitting}>
              Adicionar
            </Button>
            {errorMsg ? <div className="text-sm text-destructive">{errorMsg}</div> : null}
          </div>
        </form>

        <div className="mt-4 space-y-2">
          {employeesQuery.isLoading ? (
            <div className="text-sm text-muted-foreground">Carregando…</div>
          ) : employees.length === 0 ? (
            <div className="text-sm text-muted-foreground">Nenhum colaborador cadastrado.</div>
          ) : (
            employees.map((e) => (
              <EmployeeRow key={e.id} employee={e} organizationId={activeOrgId!} />
            ))
          )}
        </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Período</CardTitle>
        </CardHeader>
        <CardContent>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <select
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={selectedPeriodId ?? ''}
                onChange={(e) => setSelectedPeriodId(e.target.value || null)}
              >
                <option value="">Selecione…</option>
                {periods.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.month.slice(0, 7)} ({p.status})
                  </option>
                ))}
              </select>

              {selectedPeriod ? (
                <div className="text-xs text-muted-foreground">
                  Status: <span className="font-medium text-foreground">{selectedPeriod.status}</span>
                  {selectedPeriod.paid_at ? (
                    <>
                      {' '}
                      • Baixado em <span className="font-medium">{new Date(selectedPeriod.paid_at).toLocaleString()}</span>
                    </>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>

          <div className="flex flex-wrap items-end gap-2">
            <label className="block">
              <div className="mb-1 text-xs font-medium text-muted-foreground">Criar mês</div>
              <Input
                type="month"
                value={periodMonth}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setPeriodMonth(e.target.value)}
              />
            </label>
            <Button
              variant="outline"
              onClick={() => createPeriodMutation.mutate({ month: periodMonth })}
              disabled={createPeriodMutation.isPending}
            >
              Criar período
            </Button>
            {selectedPeriod ? (
              <Button
                variant={selectedPeriod.status === 'open' ? 'outline' : 'ghost'}
                onClick={() =>
                  setStatusMutation.mutate({
                    id: selectedPeriod.id,
                    status: selectedPeriod.status === 'open' ? 'closed' : 'open',
                  })
                }
                disabled={setStatusMutation.isPending}
              >
                {selectedPeriod.status === 'open' ? 'Fechar' : 'Reabrir'}
              </Button>
            ) : null}
          </div>
        </div>

        {selectedPeriod ? (
          <div className="mt-4 flex flex-wrap items-end gap-2 rounded-md border border-border bg-muted/40 p-3">
            <label className="block">
              <div className="mb-1 text-xs font-medium text-muted-foreground">Data do pagamento</div>
              <Input
                type="date"
                value={payDate}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setPayDate(e.target.value)}
              />
            </label>
            <Button
              variant="outline"
              onClick={() => queryClient.invalidateQueries({ queryKey: ['payroll', 'payments'] })}
            >
              Atualizar checklist
            </Button>
            <div className="text-xs text-muted-foreground">
              Dica: marque “Pago” por funcionário no checklist abaixo.
            </div>
          </div>
        ) : null}
        </CardContent>
      </Card>

      {selectedPeriodId ? (
        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="mb-3 text-sm font-medium text-slate-800">Lançamentos</div>
          <EntryForm
            employees={employees}
            onCreate={async (input) => createEntryMutation.mutateAsync(input)}
            disabled={selectedPeriod?.status === 'closed'}
          />

          <div className="mt-4 space-y-3">
            {entriesQuery.isLoading ? (
              <div className="text-sm text-slate-600">Carregando lançamentos…</div>
            ) : (
              <>
                <TotalsView employees={employees} entries={periodTotals.entries} />
                <div className="mt-6">
                  <div className="mb-2 text-sm font-medium text-slate-800">Checklist de pagamento</div>
                  {paymentsQuery.isLoading ? (
                    <div className="text-sm text-slate-600">Carregando checklist…</div>
                  ) : (
                    <PaymentChecklist
                      employees={employees.filter((e) => e.is_active)}
                      paymentsByEmployee={paymentsByEmployee}
                      defaultPayDate={payDate}
                      onTogglePaid={async (employeeId, nextPaid) =>
                        payMutation.mutateAsync({
                          employee_id: employeeId,
                          is_paid: nextPaid,
                          pay_date: nextPaid ? payDate : null,
                        })
                      }
                      isSaving={payMutation.isPending}
                    />
                  )}
                </div>
              </>
            )}
          </div>
        </section>
      ) : null}
    </div>
  )
}

function EmployeeRow({ employee, organizationId }: { employee: Employee; organizationId: string }) {
  const mutation = useMutation({
    mutationFn: (input: {
      name: string
      base_salary: number
      role_title: string | null
      pay_day: number | null
      is_active: boolean
    }) =>
      updateEmployee({ id: employee.id, organization_id: organizationId, ...input }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['payroll', 'employees'] })
    },
  })

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-card px-3 py-2">
      <div>
        <div className="text-sm font-medium">{employee.name}</div>
        <div className="text-xs text-muted-foreground">Salário base: {formatMoney(employee.base_salary)}</div>
        <div className="mt-1 text-xs text-muted-foreground">
          Função: {employee.role_title ?? '—'} • Dia do pagamento: {employee.pay_day ?? '—'}
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm text-muted-foreground">
        <input
          type="checkbox"
          defaultChecked={employee.is_active}
          onChange={(e) =>
            mutation.mutate({
              name: employee.name,
              base_salary: employee.base_salary,
              role_title: employee.role_title ?? null,
              pay_day: employee.pay_day ?? null,
              is_active: e.target.checked,
            })
          }
        />
        Ativo
      </label>
    </div>
  )
}

const CreateEntrySchema = z.object({
  employee_id: z.string().min(1),
  type: z.enum(['earning', 'deduction']),
  description: z.string().min(2),
  amount: z.string().min(1),
})

type CreateEntryValues = z.infer<typeof CreateEntrySchema>

function EntryForm({
  employees,
  onCreate,
  disabled,
}: {
  employees: Employee[]
  onCreate: (input: {
    employee_id: string
    type: 'earning' | 'deduction'
    description: string
    amount: number
  }) => Promise<void>
  disabled: boolean
}) {
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateEntryValues>({
    resolver: zodResolver(CreateEntrySchema),
    defaultValues: { type: 'earning' },
  })

  async function onSubmit(values: CreateEntryValues) {
    setErrorMsg(null)
    const amount = parseMoneyPtBr(values.amount)
    if (amount == null) {
      setErrorMsg('Valor inválido')
      return
    }
    try {
      await onCreate({
        employee_id: values.employee_id,
        type: values.type,
        description: values.description,
        amount,
      })
      reset({ employee_id: values.employee_id, type: values.type, description: '', amount: '' })
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Erro ao criar lançamento')
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 gap-3 md:grid-cols-6">
      <div className="md:col-span-2">
        <label className="block">
          <div className="mb-1 text-sm font-medium text-slate-700">Colaborador</div>
          <select
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
            {...register('employee_id')}
            disabled={disabled}
          >
            <option value="">Selecione…</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        </label>
        {errors.employee_id ? <div className="mt-1 text-xs text-rose-600">Selecione um colaborador</div> : null}
      </div>

      <div className="md:col-span-1">
        <label className="block">
          <div className="mb-1 text-sm font-medium text-slate-700">Tipo</div>
          <select
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
            {...register('type')}
            disabled={disabled}
          >
            <option value="earning">Provento</option>
            <option value="deduction">Desconto</option>
          </select>
        </label>
      </div>

      <div className="md:col-span-2">
        <label className="block">
          <div className="mb-1 text-sm font-medium text-slate-700">Descrição</div>
          <Input placeholder="Ex.: Vale, bônus, desconto" {...register('description')} disabled={disabled} />
        </label>
        {errors.description ? <div className="mt-1 text-xs text-rose-600">Informe a descrição</div> : null}
      </div>

      <div className="md:col-span-1">
        <MoneyInput label="Valor" {...register('amount')} disabled={disabled} />
        {errors.amount ? <div className="mt-1 text-xs text-rose-600">Informe o valor</div> : null}
      </div>

      <div className="md:col-span-6 flex items-center gap-2">
        <Button type="submit" variant="secondary" disabled={disabled || isSubmitting}>
          Adicionar lançamento
        </Button>
        {disabled ? <div className="text-sm text-amber-700">Período fechado.</div> : null}
        {errorMsg ? <div className="text-sm text-rose-700">{errorMsg}</div> : null}
      </div>
    </form>
  )
}

function TotalsView({ employees, entries }: { employees: Employee[]; entries: PayrollEntry[] }) {
  const byEmployee = useMemo(() => {
    const map = new Map<string, { earnings: number; deductions: number }>()
    for (const e of entries) {
      const cur = map.get(e.employee_id) ?? { earnings: 0, deductions: 0 }
      if (e.type === 'earning') cur.earnings += e.amount
      else cur.deductions += e.amount
      map.set(e.employee_id, cur)
    }
    return map
  }, [entries])

  const totalMonth = employees.reduce((acc, emp) => {
    const t = byEmployee.get(emp.id) ?? { earnings: 0, deductions: 0 }
    const net = emp.base_salary + t.earnings - t.deductions
    return acc + net
  }, 0)

  return (
    <div className="space-y-2">
      <div className="text-sm font-medium text-slate-800">Totais por colaborador</div>
      <div className="divide-y divide-slate-200 rounded-md border border-slate-200">
        {employees.map((emp) => {
          const t = byEmployee.get(emp.id) ?? { earnings: 0, deductions: 0 }
          const net = emp.base_salary + t.earnings - t.deductions
          return (
            <div key={emp.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
              <div className="text-sm text-slate-900">{emp.name}</div>
              <div className="text-xs text-slate-600">
                Base {formatMoney(emp.base_salary)} • + {formatMoney(t.earnings)} • - {formatMoney(t.deductions)}
              </div>
              <div className="text-sm font-medium text-slate-900">{formatMoney(net)}</div>
            </div>
          )
        })}
      </div>
      <div className="flex items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
        <div className="text-sm font-medium text-slate-800">Total do mês</div>
        <div className="text-sm font-semibold text-slate-900">{formatMoney(totalMonth)}</div>
      </div>
    </div>
  )
}

function PaymentChecklist({
  employees,
  paymentsByEmployee,
  defaultPayDate,
  onTogglePaid,
  isSaving,
}: {
  employees: Employee[]
  paymentsByEmployee: Map<string, PayrollEmployeePayment>
  defaultPayDate: string
  onTogglePaid: (employeeId: string, nextPaid: boolean) => Promise<void>
  isSaving: boolean
}) {
  return (
    <div className="divide-y divide-slate-200 rounded-md border border-slate-200">
      {employees.map((e) => {
        const payment = paymentsByEmployee.get(e.id) ?? null
        const isPaid = !!payment?.paid_at
        const payDate = payment?.pay_date ?? defaultPayDate
        return (
          <div key={e.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
            <div>
              <div className="text-sm text-slate-900">{e.name}</div>
              <div className="text-xs text-slate-600">
                Função: {e.role_title ?? '—'} • Dia: {e.pay_day ?? '—'} • Data: {payDate}
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={isPaid}
                disabled={isSaving}
                onChange={() => onTogglePaid(e.id, !isPaid)}
              />
              {isPaid ? 'Pago' : 'Não pago'}
            </label>
          </div>
        )
      })}
    </div>
  )
}

