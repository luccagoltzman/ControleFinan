import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { useOrg } from '../../app/org/useOrg'
import { queryClient } from '../../app/queryClient'
import { PageHeader } from '../../components/PageHeader'
import { MoneyInput } from '../../components/inputs/MoneyInput'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { formatMoney, parseMoneyPtBr } from '../../lib/money'
import { parseNumberPtBr } from '../../lib/number'
import type { ChangeEvent } from 'react'
import { fetchProducts } from '../products/productsApi'
import { createSale, deleteSale, fetchSales, type Sale } from './salesApi'

const CreateSaleSchema = z.object({
  product_id: z.string().min(1, 'Selecione um produto'),
  sold_date: z.string().min(10),
  qty: z.string().min(1),
  unit_price: z.string().min(1),
  unit_cost_snapshot: z.string().min(1),
  notes: z.string().optional(),
})

type CreateSaleValues = z.infer<typeof CreateSaleSchema>

function monthRange(monthYYYYMM: string) {
  const [y, m] = monthYYYYMM.split('-').map(Number)
  const from = new Date(Date.UTC(y!, (m! - 1)!, 1, 0, 0, 0))
  const to = new Date(Date.UTC(y!, m!, 1, 0, 0, 0))
  return { fromIso: from.toISOString(), toIso: to.toISOString() }
}

export function SalesPage() {
  const { activeOrgId } = useOrg()
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7))
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const { fromIso, toIso } = useMemo(() => monthRange(month), [month])

  const productsQuery = useQuery({
    queryKey: ['products', { org: activeOrgId }],
    queryFn: () => fetchProducts(activeOrgId!),
    enabled: !!activeOrgId,
  })

  const salesQuery = useQuery({
    queryKey: ['sales', { org: activeOrgId, month }],
    queryFn: () => fetchSales({ organizationId: activeOrgId!, fromIso, toIso }),
    enabled: !!activeOrgId,
  })

  const createMutation = useMutation({
    mutationFn: (input: {
      product_id: string
      sold_at: string
      qty: number
      unit_price: number
      unit_cost_snapshot: number
      notes: string | null
    }) => createSale({ organization_id: activeOrgId!, ...input }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['sales'] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteSale({ organization_id: activeOrgId!, id }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['sales'] })
    },
  })

  const {
    register,
    watch,
    setValue,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateSaleValues>({
    resolver: zodResolver(CreateSaleSchema),
    defaultValues: { sold_date: new Date().toISOString().slice(0, 10) },
  })

  const selectedProductId = watch('product_id')

  const selectedProduct = useMemo(() => {
    return (productsQuery.data ?? []).find((p) => p.id === selectedProductId) ?? null
  }, [productsQuery.data, selectedProductId])

  function onPickProduct(productId: string) {
    setValue('product_id', productId, { shouldValidate: true })
    const p = (productsQuery.data ?? []).find((x) => x.id === productId)
    const latestCost = p?.latest_cost?.cost ?? null
    if (latestCost != null) setValue('unit_cost_snapshot', String(latestCost).replace('.', ','), { shouldValidate: true })
  }

  async function onSubmit(values: CreateSaleValues) {
    setErrorMsg(null)
    const qty = parseNumberPtBr(values.qty)
    const unitPrice = parseMoneyPtBr(values.unit_price)
    const unitCost = parseMoneyPtBr(values.unit_cost_snapshot)

    if (qty == null || qty <= 0) return setErrorMsg('Quantidade inválida')
    if (unitPrice == null) return setErrorMsg('Preço unitário inválido')
    if (unitCost == null) return setErrorMsg('Custo (snapshot) inválido')

    try {
      await createMutation.mutateAsync({
        product_id: values.product_id,
        sold_at: new Date(`${values.sold_date}T12:00:00`).toISOString(),
        qty,
        unit_price: unitPrice,
        unit_cost_snapshot: unitCost,
        notes: values.notes?.trim() ? values.notes.trim() : null,
      })
      reset({
        product_id: values.product_id,
        sold_date: values.sold_date,
        qty: '',
        unit_price: '',
        unit_cost_snapshot: values.unit_cost_snapshot,
        notes: '',
      })
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Erro ao salvar venda')
    }
  }

  const totals = useMemo(() => {
    const sales = salesQuery.data ?? []
    const revenue = sales.reduce((acc, s) => acc + s.qty * s.unit_price, 0)
    const cost = sales.reduce((acc, s) => acc + s.qty * s.unit_cost_snapshot, 0)
    const profit = revenue - cost
    const margin = revenue > 0 ? profit / revenue : 0
    return { revenue, cost, profit, margin }
  }, [salesQuery.data])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Vendas"
        description="Registre vendas e acompanhe faturamento e lucro bruto (com snapshot de custo)."
        right={
          <label className="block">
            <div className="mb-1 text-xs font-medium text-muted-foreground">Mês</div>
            <Input
              type="month"
              value={month}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setMonth(e.target.value)}
            />
          </label>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Nova venda</CardTitle>
        </CardHeader>
        <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 gap-3 md:grid-cols-10">
          <div className="md:col-span-3">
            <label className="block">
              <div className="mb-1 text-sm font-medium text-muted-foreground">Produto</div>
              <select
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={selectedProductId ?? ''}
                onChange={(e) => onPickProduct(e.target.value)}
              >
                <option value="">Selecione…</option>
                {(productsQuery.data ?? []).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.unit})
                  </option>
                ))}
              </select>
            </label>
            {errors.product_id ? <div className="mt-1 text-xs text-destructive">{errors.product_id.message}</div> : null}
          </div>

          <div className="md:col-span-2">
            <label className="block">
              <div className="mb-1 text-sm font-medium text-muted-foreground">Data</div>
              <Input type="date" {...register('sold_date')} />
            </label>
          </div>

          <div className="md:col-span-1">
            <label className="block">
              <div className="mb-1 text-sm font-medium text-muted-foreground">
                Qtd. {selectedProduct?.unit ? `(${selectedProduct.unit})` : ''}
              </div>
              <Input inputMode="decimal" placeholder="0" {...register('qty')} />
            </label>
          </div>

          <div className="md:col-span-2">
            <MoneyInput label="Preço unitário" {...register('unit_price')} />
          </div>

          <div className="md:col-span-2">
            <MoneyInput
              label="Custo (snapshot)"
              {...register('unit_cost_snapshot')}
            />
            {selectedProduct?.latest_cost?.cost != null ? (
              <div className="mt-1 text-xs text-muted-foreground">
                Último custo do produto: {formatMoney(selectedProduct.latest_cost.cost)}
              </div>
            ) : null}
          </div>

          <div className="md:col-span-8">
            <label className="block">
              <div className="mb-1 text-sm font-medium text-muted-foreground">Observações (opcional)</div>
              <Input placeholder="Ex.: Cliente X, NF, etc." {...register('notes')} />
            </label>
          </div>

          <div className="md:col-span-2 flex items-end">
            <Button type="submit" disabled={isSubmitting}>
              Salvar venda
            </Button>
          </div>

          {errorMsg ? <div className="md:col-span-10 text-sm text-destructive">{errorMsg}</div> : null}
        </form>
        </CardContent>
      </Card>

      <section className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <Kpi title="Faturamento" value={formatMoney(totals.revenue)} />
        <Kpi title="Custo (snapshot)" value={formatMoney(totals.cost)} />
        <Kpi title="Lucro bruto" value={formatMoney(totals.profit)} />
        <Kpi title="Margem" value={`${(totals.margin * 100).toFixed(2)}%`} />
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Vendas do mês</CardTitle>
        </CardHeader>
        <CardContent>

        {salesQuery.isLoading ? (
          <div className="text-sm text-muted-foreground">Carregando…</div>
        ) : salesQuery.isError ? (
          <div className="text-sm text-rose-700">Erro ao carregar vendas.</div>
        ) : (salesQuery.data ?? []).length === 0 ? (
          <div className="text-sm text-muted-foreground">Nenhuma venda registrada neste mês.</div>
        ) : (
          <div className="divide-y divide-border rounded-md border border-border">
            {(salesQuery.data ?? []).map((s) => (
              <SaleRow
                key={s.id}
                sale={s}
                onDelete={() => deleteMutation.mutate(s.id)}
                isDeleting={deleteMutation.isPending}
              />
            ))}
          </div>
        )}
        </CardContent>
      </Card>
    </div>
  )
}

function Kpi({ title, value }: { title: string; value: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold">{value}</div>
      </CardContent>
    </Card>
  )
}

function SaleRow({
  sale,
  onDelete,
  isDeleting,
}: {
  sale: Sale
  onDelete: () => void
  isDeleting: boolean
}) {
  const revenue = sale.qty * sale.unit_price
  const cost = sale.qty * sale.unit_cost_snapshot
  const profit = revenue - cost
  const unit = sale.product?.unit

  return (
    <div className="grid grid-cols-1 gap-2 px-3 py-2 md:grid-cols-[1.2fr_0.6fr_0.6fr_0.6fr_0.6fr_auto] md:items-center">
      <div>
        <div className="text-sm font-medium text-slate-900">
          {sale.product?.name ?? 'Produto'} • {new Date(sale.sold_at).toISOString().slice(0, 10)}
        </div>
        <div className="text-xs text-slate-600">
          Qtd: {sale.qty}
          {unit ? ` ${unit}` : ''} • Preço: {formatMoney(sale.unit_price)} • Custo:{' '}
          {formatMoney(sale.unit_cost_snapshot)}
          {sale.notes ? ` • ${sale.notes}` : ''}
        </div>
      </div>
      <div className="text-sm text-slate-900">Receita {formatMoney(revenue)}</div>
      <div className="text-sm text-slate-900">Custo {formatMoney(cost)}</div>
      <div className="text-sm font-medium text-slate-900">Lucro {formatMoney(profit)}</div>
      <div className="text-sm text-slate-700">
        {revenue > 0 ? `${((profit / revenue) * 100).toFixed(2)}%` : '—'}
      </div>
      <div className="md:text-right">
        <Button variant="ghost" onClick={onDelete} disabled={isDeleting}>
          Excluir
        </Button>
      </div>
    </div>
  )
}

