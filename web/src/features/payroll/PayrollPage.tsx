import { PageHeader } from '../../components/PageHeader'
import { useMutation, useQuery } from '@tanstack/react-query'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { useOrg } from '../../app/org/useOrg'
import { queryClient } from '../../app/queryClient'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { MoneyInput } from '../../components/inputs/MoneyInput'
import { formatMoney, parseMoneyPtBr } from '../../lib/money'
import {
  createEmployee,
  createEntry,
  createPeriod,
  fetchEmployees,
  fetchEntries,
  fetchPeriods,
  setPeriodStatus,
  type Employee,
  type PayrollEntry,
  updateEmployee,
} from './payrollApi'

const CreateEmployeeSchema = z.object({
  name: z.string().min(2, 'Informe um nome'),
  base_salary: z.string().optional(),
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
    mutationFn: (input: { name: string; base_salary: number }) =>
      createEmployee({ organization_id: activeOrgId!, ...input }),
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
    try {
      await createEmployeeMutation.mutateAsync({ name: values.name, base_salary: salary })
      reset({ name: '', base_salary: '' })
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

      <section className="rounded-lg border border-slate-200 bg-slate-50 p-4">
        <div className="mb-3 text-sm font-medium text-slate-800">Colaboradores</div>

        <form onSubmit={handleSubmit(onCreateEmployee)} className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <Input placeholder="Nome" {...register('name')} />
            {errors.name ? <div className="mt-1 text-xs text-rose-600">{errors.name.message}</div> : null}
          </div>
          <div>
            <MoneyInput label="Salário base (opcional)" {...register('base_salary')} />
          </div>
          <div className="sm:col-span-3 flex items-center gap-2">
            <Button type="submit" disabled={isSubmitting}>
              Adicionar
            </Button>
            {errorMsg ? <div className="text-sm text-rose-700">{errorMsg}</div> : null}
          </div>
        </form>

        <div className="mt-4 space-y-2">
          {employeesQuery.isLoading ? (
            <div className="text-sm text-slate-600">Carregando…</div>
          ) : employees.length === 0 ? (
            <div className="text-sm text-slate-700">Nenhum colaborador cadastrado.</div>
          ) : (
            employees.map((e) => (
              <EmployeeRow key={e.id} employee={e} organizationId={activeOrgId!} />
            ))
          )}
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-sm font-medium text-slate-800">Período</div>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <select
                className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
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
                <div className="text-xs text-slate-600">
                  Status: <span className="font-medium text-slate-800">{selectedPeriod.status}</span>
                </div>
              ) : null}
            </div>
          </div>

          <div className="flex flex-wrap items-end gap-2">
            <label className="block">
              <div className="mb-1 text-xs font-medium text-slate-700">Criar mês</div>
              <Input type="month" value={periodMonth} onChange={(e) => setPeriodMonth(e.target.value)} />
            </label>
            <Button
              variant="secondary"
              onClick={() => createPeriodMutation.mutate({ month: periodMonth })}
              disabled={createPeriodMutation.isPending}
            >
              Criar período
            </Button>
            {selectedPeriod ? (
              <Button
                variant={selectedPeriod.status === 'open' ? 'secondary' : 'ghost'}
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
      </section>

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
              <TotalsView employees={employees} entries={periodTotals.entries} />
            )}
          </div>
        </section>
      ) : null}
    </div>
  )
}

function EmployeeRow({ employee, organizationId }: { employee: Employee; organizationId: string }) {
  const mutation = useMutation({
    mutationFn: (input: { name: string; base_salary: number; is_active: boolean }) =>
      updateEmployee({ id: employee.id, organization_id: organizationId, ...input }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['payroll', 'employees'] })
    },
  })

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-slate-200 bg-white px-3 py-2">
      <div>
        <div className="text-sm font-medium text-slate-900">{employee.name}</div>
        <div className="text-xs text-slate-600">Salário base: {formatMoney(employee.base_salary)}</div>
      </div>
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          defaultChecked={employee.is_active}
          onChange={(e) =>
            mutation.mutate({
              name: employee.name,
              base_salary: employee.base_salary,
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

