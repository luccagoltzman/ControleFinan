import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useState, type ChangeEvent } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Banknote, Pencil } from 'lucide-react'
import { PageHeader } from '../../components/PageHeader'
import { Button } from '../../components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../components/ui/dialog'
import { Input } from '../../components/ui/input'
import { Label } from '../../components/ui/label'
import { MoneyInput } from '../../components/inputs/MoneyInput'
import { toast } from '../../components/toast/ToastHost'
import { useOrg } from '../../app/org/useOrg'
import { queryClient } from '../../app/queryClient'
import { formatMoney, parseMoneyPtBr } from '../../lib/money'
import {
  createMiscExpense,
  deleteMiscExpense,
  fetchMiscExpenses,
  updateMiscExpense,
  type MiscExpense,
} from './miscExpensesApi'

function monthRange(monthYYYYMM: string) {
  const [y, m] = monthYYYYMM.split('-').map(Number)
  const from = new Date(Date.UTC(y!, (m! - 1)!, 1, 0, 0, 0))
  const to = new Date(Date.UTC(y!, m!, 1, 0, 0, 0))
  return { fromIso: from.toISOString(), toIso: to.toISOString() }
}

const ExpenseFormSchema = z.object({
  spent_date: z.string().min(10),
  amount: z.string().min(1, 'Informe o valor'),
  description: z.string().optional(),
  split_with_partner: z.boolean(),
})

type ExpenseFormValues = z.infer<typeof ExpenseFormSchema>

export function ExpensesPage() {
  const { activeOrgId } = useOrg()
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7))
  const [splitTotalView, setSplitTotalView] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<MiscExpense | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  const { fromIso, toIso } = useMemo(() => monthRange(month), [month])

  const expensesQuery = useQuery({
    queryKey: ['misc-expenses', { org: activeOrgId, month }],
    queryFn: () => fetchMiscExpenses({ organizationId: activeOrgId!, fromIso, toIso }),
    enabled: !!activeOrgId,
  })

  const saveMutation = useMutation({
    mutationFn: async (input: {
      id?: string
      spent_at: string
      amount: number
      description: string
      split_with_partner: boolean
    }) => {
      if (!activeOrgId) return
      if (input.id) {
        await updateMiscExpense({
          organization_id: activeOrgId,
          id: input.id,
          spent_at: input.spent_at,
          amount: input.amount,
          description: input.description,
          split_with_partner: input.split_with_partner,
        })
      } else {
        await createMiscExpense({
          organization_id: activeOrgId,
          spent_at: input.spent_at,
          amount: input.amount,
          description: input.description,
          split_with_partner: input.split_with_partner,
        })
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['misc-expenses'] })
      toast({ title: editing ? 'Despesa atualizada' : 'Despesa registrada' })
      setDialogOpen(false)
      setEditing(null)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteMiscExpense({ organization_id: activeOrgId!, id }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['misc-expenses'] })
      toast({ title: 'Despesa excluída' })
    },
  })

  const toggleSplitMutation = useMutation({
    mutationFn: (input: { id: string; split_with_partner: boolean }) =>
      updateMiscExpense({
        organization_id: activeOrgId!,
        id: input.id,
        split_with_partner: input.split_with_partner,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['misc-expenses'] })
    },
  })

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ExpenseFormValues>({
    resolver: zodResolver(ExpenseFormSchema),
    defaultValues: {
      spent_date: new Date().toISOString().slice(0, 10),
      amount: '',
      description: '',
      split_with_partner: false,
    },
  })

  useEffect(() => {
    if (!dialogOpen) return
    if (editing) {
      reset({
        spent_date: editing.spent_at.slice(0, 10),
        amount: String(editing.amount).replace('.', ','),
        description: editing.description,
        split_with_partner: editing.split_with_partner,
      })
    } else {
      reset({
        spent_date: new Date().toISOString().slice(0, 10),
        amount: '',
        description: '',
        split_with_partner: false,
      })
    }
  }, [dialogOpen, editing, reset])

  const splitPartnerWatch = watch('split_with_partner')
  const amountWatch = watch('amount')
  const parsedAmountPreview = parseMoneyPtBr(amountWatch ?? '')

  async function onSubmitForm(values: ExpenseFormValues) {
    setFormError(null)
    const amount = parseMoneyPtBr(values.amount)
    if (amount == null || amount < 0) return setFormError('Valor inválido')
    const spent_at = new Date(`${values.spent_date}T12:00:00`).toISOString()
    try {
      await saveMutation.mutateAsync({
        id: editing?.id,
        spent_at,
        amount,
        description: values.description?.trim() ?? '',
        split_with_partner: values.split_with_partner,
      })
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Erro ao salvar')
    }
  }

  const rows = expensesQuery.data ?? []
  const total = useMemo(() => rows.reduce((a, r) => a + r.amount, 0), [rows])
  const halfTotal = total / 2

  return (
    <div className="space-y-6">
      <PageHeader
        title="Despesas avulsas"
        description="Registro independente do faturamento e lucro de vendas — apenas controlo de gastos."
        right={
          <label className="block">
            <div className="mb-1 text-xs font-medium text-muted-foreground">Mês</div>
            <Input
              type="month"
              value={month}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setMonth(e.target.value)}
              className="w-[170px]"
            />
          </label>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0 pb-3">
            <div>
              <CardTitle>Lançamentos</CardTitle>
              <CardDescription>Inclua despesas pontuais; marque se o gasto é dividido 50/50 com o sócio.</CardDescription>
            </div>
            <Button
              type="button"
              onClick={() => {
                setEditing(null)
                setDialogOpen(true)
              }}
            >
              Nova despesa
            </Button>
            <Dialog
              open={dialogOpen}
              onOpenChange={(open) => {
                setDialogOpen(open)
                if (!open) setEditing(null)
              }}
            >
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>{editing ? 'Editar despesa' : 'Nova despesa'}</DialogTitle>
                  <DialogDescription>Valores em reais. Não altera relatórios de vendas.</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit(onSubmitForm)} className="grid gap-4">
                  <div>
                    <Label>Data</Label>
                    <Input className="mt-1" type="date" {...register('spent_date')} />
                    {errors.spent_date ? (
                      <div className="mt-1 text-xs text-destructive">{errors.spent_date.message}</div>
                    ) : null}
                  </div>
                  <MoneyInput label="Valor (R$)" {...register('amount')} />
                  {errors.amount ? <div className="text-xs text-destructive">{errors.amount.message}</div> : null}
                  <div>
                    <Label>Descrição</Label>
                    <Input className="mt-1" placeholder="Ex.: combustível, software…" {...register('description')} />
                  </div>
                  <label className="flex cursor-pointer items-start gap-2 text-sm">
                    <input type="checkbox" className="mt-1" {...register('split_with_partner')} />
                    <span>
                      <span className="font-medium">Dividir com o sócio (50/50)</span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        Se marcado, cada um assume metade deste lançamento para fins de controlo.
                      </span>
                    </span>
                  </label>
                  {splitPartnerWatch && parsedAmountPreview != null ? (
                    <div className="rounded-md border border-border bg-muted/50 px-3 py-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Sua parte (estim.)</span>
                        <span className="font-medium">{formatMoney(parsedAmountPreview / 2)}</span>
                      </div>
                      <div className="mt-1 flex justify-between">
                        <span className="text-muted-foreground">Sócio (estim.)</span>
                        <span className="font-medium">{formatMoney(parsedAmountPreview / 2)}</span>
                      </div>
                    </div>
                  ) : null}
                  {formError ? <div className="text-sm text-destructive">{formError}</div> : null}
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                      Cancelar
                    </Button>
                    <Button type="submit" disabled={isSubmitting || saveMutation.isPending}>
                      {saveMutation.isPending ? 'Salvando…' : 'Salvar'}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent>
            {expensesQuery.isLoading ? (
              <div className="text-sm text-muted-foreground">Carregando…</div>
            ) : expensesQuery.isError ? (
              <div className="text-sm text-destructive">Erro ao carregar despesas.</div>
            ) : rows.length === 0 ? (
              <div className="text-sm text-muted-foreground">Nenhuma despesa neste mês.</div>
            ) : (
              <div className="overflow-x-auto rounded-md border border-border">
                <table className="w-full min-w-[520px] text-sm">
                  <thead className="bg-muted/50 text-left text-xs font-medium uppercase text-muted-foreground">
                    <tr>
                      <th className="p-2">Data</th>
                      <th className="p-2">Descrição</th>
                      <th className="p-2 text-right">Valor</th>
                      <th className="p-2 text-center">Dividir c/ sócio</th>
                      <th className="p-2 text-right">Por pessoa</th>
                      <th className="p-2 w-24" />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.id} className="border-t border-border">
                        <td className="p-2 whitespace-nowrap">{r.spent_at.slice(0, 10)}</td>
                        <td className="p-2">{r.description || '—'}</td>
                        <td className="p-2 text-right font-medium">{formatMoney(r.amount)}</td>
                        <td className="p-2 text-center">
                          <input
                            type="checkbox"
                            className="h-4 w-4 cursor-pointer accent-primary"
                            checked={r.split_with_partner}
                            onChange={(e: ChangeEvent<HTMLInputElement>) =>
                              toggleSplitMutation.mutate({ id: r.id, split_with_partner: e.target.checked })
                            }
                            disabled={toggleSplitMutation.isPending}
                            aria-label="Dividir com sócio"
                          />
                        </td>
                        <td className="p-2 text-right text-muted-foreground">
                          {r.split_with_partner ? formatMoney(r.amount / 2) : '—'}
                        </td>
                        <td className="p-2 text-right">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2"
                            onClick={() => {
                              setEditing(r)
                              setDialogOpen(true)
                            }}
                          >
                            <Pencil className="h-4 w-4" aria-hidden />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2 text-destructive"
                            onClick={() => deleteMutation.mutate(r.id)}
                            disabled={deleteMutation.isPending}
                          >
                            Excluir
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Banknote className="h-5 w-5" aria-hidden />
              Totais do mês
            </CardTitle>
            <CardDescription>Soma dos lançamentos filtrados pelo mês acima.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="text-xs font-medium text-muted-foreground">Total gasto</div>
              <div className="text-2xl font-semibold tracking-tight">{formatMoney(total)}</div>
            </div>

            <div className="rounded-lg border border-border bg-muted/30 p-3">
              <label className="flex cursor-pointer items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-1 accent-primary"
                  checked={splitTotalView}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setSplitTotalView(e.target.checked)}
                />
                <span>
                  <span className="font-medium">Dividir total com o sócio (50/50)</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    Apenas visualização: mostra quanto cabe a cada um se o total fosse partilhado ao meio.
                  </span>
                </span>
              </label>
              {splitTotalView ? (
                <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                  <div className="rounded-md bg-background/80 px-3 py-2 shadow-sm">
                    <div className="text-xs text-muted-foreground">Você</div>
                    <div className="font-semibold">{formatMoney(halfTotal)}</div>
                  </div>
                  <div className="rounded-md bg-background/80 px-3 py-2 shadow-sm">
                    <div className="text-xs text-muted-foreground">Sócio</div>
                    <div className="font-semibold">{formatMoney(halfTotal)}</div>
                  </div>
                </div>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
