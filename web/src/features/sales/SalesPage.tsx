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
import { Label } from '../../components/ui/label'
import { Textarea } from '../../components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../../components/ui/dialog'
import { toast } from '../../components/toast/ToastHost'
import { formatMoney, parseMoneyPtBr } from '../../lib/money'
import { parseNumberPtBr } from '../../lib/number'
import type { ChangeEvent } from 'react'
import { fetchProducts } from '../products/productsApi'
import { createSale, deleteSale, fetchSales, type Sale } from './salesApi'
import { SaleAttachmentsSection } from './SaleAttachmentsSection'
import { fetchRegions } from '../regions/regionsApi'

const CreateSaleSchema = z.object({
  region_id: z.string().optional(),
  product_id: z.string().min(1, 'Selecione um produto'),
  sold_date: z.string().min(10),
  qty_unit: z.enum(['kg', 'un']),
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

  const regionsQuery = useQuery({
    queryKey: ['regions', { org: activeOrgId }],
    queryFn: () => fetchRegions(activeOrgId!),
    enabled: !!activeOrgId,
  })

  const salesQuery = useQuery({
    queryKey: ['sales', { org: activeOrgId, month }],
    queryFn: () => fetchSales({ organizationId: activeOrgId!, fromIso, toIso }),
    enabled: !!activeOrgId,
  })

  const createMutation = useMutation({
    mutationFn: (input: {
      region_id: string | null
      product_id: string
      sold_at: string
      qty: number
      qty_unit: 'kg' | 'un'
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
    defaultValues: { sold_date: new Date().toISOString().slice(0, 10), qty_unit: 'kg' },
  })

  const selectedProductId = watch('product_id')
  const qtyUnit = watch('qty_unit')
  const unitPriceRaw = watch('unit_price')

  const selectedProduct = useMemo(() => {
    return (productsQuery.data ?? []).find((p) => p.id === selectedProductId) ?? null
  }, [productsQuery.data, selectedProductId])

  function computeSuggestedCostSnapshot(productId: string, nextQtyUnit: 'kg' | 'un') {
    const p = (productsQuery.data ?? []).find((x) => x.id === productId)
    if (!p) return null

    const costKg = p.latest_cost_kg?.cost ?? null
    const costUn = p.latest_cost_un?.cost ?? null

    if (nextQtyUnit === 'kg') {
      if (costKg != null) return costKg
      return null
    }

    if (costUn != null) return costUn
    return null
  }

  function computeSuggestedUnitPrice(productId: string, nextQtyUnit: 'kg' | 'un') {
    const p = (productsQuery.data ?? []).find((x) => x.id === productId)
    if (!p) return null
    const cost = computeSuggestedCostSnapshot(productId, nextQtyUnit)
    if (cost == null) return null
    const target = nextQtyUnit === 'kg' ? p.target_profit_kg : p.target_profit_un
    if (target == null) return null
    return cost + target
  }

  function onPickProduct(productId: string) {
    setValue('product_id', productId, { shouldValidate: true })
    const suggested = computeSuggestedCostSnapshot(productId, qtyUnit)
    if (suggested != null) {
      setValue('unit_cost_snapshot', String(suggested).replace('.', ','), { shouldValidate: true })
    }

    const suggestedPrice = computeSuggestedUnitPrice(productId, qtyUnit)
    if ((!unitPriceRaw || !unitPriceRaw.trim()) && suggestedPrice != null) {
      setValue('unit_price', String(suggestedPrice).replace('.', ','), { shouldValidate: true })
    }
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
        region_id: values.region_id?.trim() ? values.region_id.trim() : null,
        product_id: values.product_id,
        sold_at: new Date(`${values.sold_date}T12:00:00`).toISOString(),
        qty,
        qty_unit: values.qty_unit,
        unit_price: unitPrice,
        unit_cost_snapshot: unitCost,
        notes: values.notes?.trim() ? values.notes.trim() : null,
      })
      toast({ title: 'Venda salva', description: `${qty} ${values.qty_unit} • ${formatMoney(unitPrice)}` })
      reset({
        product_id: values.product_id,
        sold_date: values.sold_date,
        qty_unit: values.qty_unit,
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
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Cadastros</CardTitle>
            <div className="text-sm text-muted-foreground">
              Cadastre uma venda em poucos passos (produto → unidade → qtd → preço).
            </div>
          </div>
          <Dialog>
            <DialogTrigger asChild>
              <Button>Novo lançamento</Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl">
              <DialogHeader>
                <DialogTitle>Nova venda</DialogTitle>
                <DialogDescription>
                  Escolha o produto e a unidade. O sistema sugere custo e preço, e você ajusta se precisar.
                </DialogDescription>
              </DialogHeader>

              <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 gap-4 md:grid-cols-12">
                <div className="md:col-span-4">
                  <Label>Região</Label>
                  <select
                    className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    {...register('region_id')}
                  >
                    <option value="">(Sem região)</option>
                    {(regionsQuery.data ?? []).map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="md:col-span-5">
                  <Label>Produto</Label>
                  <select
                    className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={selectedProductId ?? ''}
                    onChange={(e) => onPickProduct(e.target.value)}
                  >
                    <option value="">Selecione…</option>
                    {(productsQuery.data ?? []).map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                  {errors.product_id ? (
                    <div className="mt-1 text-xs text-destructive">{errors.product_id.message}</div>
                  ) : null}
                </div>

                <div className="md:col-span-3">
                  <Label>Data</Label>
                  <Input className="mt-1" type="date" {...register('sold_date')} />
                </div>

                <div className="md:col-span-2">
                  <Label>Unidade</Label>
                  <select
                    className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    {...register('qty_unit')}
                    onChange={(e) => {
                      const next = e.target.value as 'kg' | 'un'
                      setValue('qty_unit', next, { shouldValidate: true })
                      if (selectedProductId) {
                        const suggested = computeSuggestedCostSnapshot(selectedProductId, next)
                        if (suggested != null) {
                          setValue('unit_cost_snapshot', String(suggested).replace('.', ','), {
                            shouldValidate: true,
                          })
                        }

                        const suggestedPrice = computeSuggestedUnitPrice(selectedProductId, next)
                        if ((!unitPriceRaw || !unitPriceRaw.trim()) && suggestedPrice != null) {
                          setValue('unit_price', String(suggestedPrice).replace('.', ','), {
                            shouldValidate: true,
                          })
                        }
                      }
                    }}
                  >
                    <option value="kg">kg</option>
                    <option value="un">un</option>
                  </select>
                </div>

                <div className="md:col-span-2">
                  <Label>Qtd. ({qtyUnit})</Label>
                  <Input className="mt-1" inputMode="decimal" placeholder="0" {...register('qty')} />
                </div>

                <div className="md:col-span-4">
                  <MoneyInput label={`Preço por ${qtyUnit}`} {...register('unit_price')} />
                  {selectedProduct ? (
                    <div className="mt-1 text-xs text-muted-foreground">
                      Sugestão (custo + alvo):{' '}
                      {(() => {
                        const cost =
                          qtyUnit === 'kg' ? selectedProduct.latest_cost_kg?.cost ?? null : selectedProduct.latest_cost_un?.cost ?? null
                        const target = qtyUnit === 'kg' ? selectedProduct.target_profit_kg : selectedProduct.target_profit_un
                        if (cost == null || target == null) return '—'
                        return formatMoney(cost + target)
                      })()}
                    </div>
                  ) : null}
                </div>

                <div className="md:col-span-4">
                  <MoneyInput label="Custo (snapshot)" {...register('unit_cost_snapshot')} />
                  {!selectedProduct ? null : qtyUnit === 'kg' && !selectedProduct.latest_cost_kg?.cost ? (
                    <div className="mt-1 text-xs text-destructive">Cadastre o custo em kg no produto.</div>
                  ) : qtyUnit === 'un' && !selectedProduct.latest_cost_un?.cost ? (
                    <div className="mt-1 text-xs text-destructive">Cadastre o custo em unidade no produto.</div>
                  ) : null}
                </div>

                <div className="md:col-span-12">
                  <Label>Observações</Label>
                  <Textarea className="mt-1" placeholder="Cliente, NF, detalhes…" {...register('notes')} />
                </div>

                {errorMsg ? <div className="md:col-span-12 text-sm text-destructive">{errorMsg}</div> : null}

                <DialogFooter className="md:col-span-12">
                  <Button type="submit" disabled={isSubmitting}>
                    Salvar venda
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </CardHeader>
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
                product={(productsQuery.data ?? []).find((p) => p.id === s.product_id) ?? null}
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
  product,
  onDelete,
  isDeleting,
}: {
  sale: Sale
  product: { name: string; target_profit_kg: number | null; target_profit_un: number | null } | null
  onDelete: () => void
  isDeleting: boolean
}) {
  const [detailsOpen, setDetailsOpen] = useState(false)
  const revenue = sale.qty * sale.unit_price
  const cost = sale.qty * sale.unit_cost_snapshot
  const profit = revenue - cost
  const unit = sale.qty_unit
  const targetProfitPerUnit =
    unit === 'kg' ? product?.target_profit_kg ?? null : unit === 'un' ? product?.target_profit_un ?? null : null
  const targetProfitTotal = targetProfitPerUnit != null ? sale.qty * targetProfitPerUnit : null
  const deltaVsTarget = targetProfitTotal != null ? profit - targetProfitTotal : null
  const profitPerUnit = sale.unit_price - sale.unit_cost_snapshot
  const deltaPerUnitVsTarget = targetProfitPerUnit != null ? profitPerUnit - targetProfitPerUnit : null

  function centsLabel(value: number) {
    const cents = Math.round(Math.abs(value) * 100)
    return `${cents} centavos`
  }

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
          {sale.region?.name ? ` • Região ${sale.region.name}` : ''}
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
        <div className="flex items-center justify-end gap-1">
          <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
            <DialogTrigger asChild>
              <Button variant="ghost">Detalhes</Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Relatório da venda</DialogTitle>
                <DialogDescription>
                  {product?.name ?? sale.product?.name ?? 'Produto'} • {new Date(sale.sold_at).toISOString().slice(0, 10)}
                </DialogDescription>
              </DialogHeader>

              <div className="grid grid-cols-1 gap-3">
                <div className="rounded-lg border border-border bg-card p-4 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Quantidade</span>
                    <span className="font-medium">
                      {sale.qty} {unit}
                    </span>
                  </div>
                  <div className="mt-2 flex justify-between">
                    <span className="text-muted-foreground">Preço (digitado)</span>
                    <span className="font-medium">{formatMoney(sale.unit_price)}</span>
                  </div>
                  <div className="mt-2 flex justify-between">
                    <span className="text-muted-foreground">Custo (snapshot)</span>
                    <span className="font-medium">{formatMoney(sale.unit_cost_snapshot)}</span>
                  </div>
                  <div className="mt-3 rounded-md bg-muted px-3 py-2">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Acima do custo (por {unit})</span>
                      <span className="font-semibold">
                        {formatMoney(profitPerUnit)} ({centsLabel(profitPerUnit)})
                      </span>
                    </div>
                    <div className="mt-2 flex justify-between">
                      <span className="text-muted-foreground">Acima do custo (total)</span>
                      <span className="font-semibold">{formatMoney(profit)}</span>
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-border bg-card p-4 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Receita</span>
                    <span className="font-medium">{formatMoney(revenue)}</span>
                  </div>
                  <div className="mt-2 flex justify-between">
                    <span className="text-muted-foreground">Custo total</span>
                    <span className="font-medium">{formatMoney(cost)}</span>
                  </div>
                  <div className="mt-2 flex justify-between">
                    <span className="text-muted-foreground">Lucro</span>
                    <span className="font-semibold">{formatMoney(profit)}</span>
                  </div>
                  <div className="mt-2 flex justify-between">
                    <span className="text-muted-foreground">Margem</span>
                    <span className="font-medium">{revenue > 0 ? `${((profit / revenue) * 100).toFixed(2)}%` : '—'}</span>
                  </div>
                </div>

                <div className="rounded-lg border border-border bg-card p-4 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Alvo de lucro ({unit})</span>
                    <span className="font-medium">{targetProfitPerUnit != null ? formatMoney(targetProfitPerUnit) : '—'}</span>
                  </div>
                  <div className="mt-2 flex justify-between">
                    <span className="text-muted-foreground">Alvo total</span>
                    <span className="font-medium">{targetProfitTotal != null ? formatMoney(targetProfitTotal) : '—'}</span>
                  </div>
                  <div className="mt-3 rounded-md bg-muted px-3 py-2">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Situação</span>
                      {deltaPerUnitVsTarget == null ? (
                        <span className="font-medium">Sem alvo cadastrado</span>
                      ) : deltaPerUnitVsTarget >= 0 ? (
                        <span className="font-semibold text-emerald-700">
                          Atingiu • +{formatMoney(deltaPerUnitVsTarget)} por {unit} ({centsLabel(deltaPerUnitVsTarget)})
                        </span>
                      ) : (
                        <span className="font-semibold text-rose-700">
                          Não atingiu • faltou {formatMoney(Math.abs(deltaPerUnitVsTarget))} por {unit} ({centsLabel(deltaPerUnitVsTarget)})
                        </span>
                      )}
                    </div>
                    <div className="mt-2 flex justify-between">
                      <span className="text-muted-foreground">Diferença vs alvo (total)</span>
                      {deltaVsTarget == null ? (
                        <span className="font-semibold">—</span>
                      ) : deltaVsTarget >= 0 ? (
                        <span className="font-semibold text-emerald-700">+{formatMoney(deltaVsTarget)}</span>
                      ) : (
                        <span className="font-semibold text-rose-700">-{formatMoney(Math.abs(deltaVsTarget))}</span>
                      )}
                    </div>
                  </div>
                  <div className="mt-2 flex justify-between">
                    <span className="text-muted-foreground">Diferença (lucro - alvo)</span>
                    <span className="font-semibold">
                      {deltaVsTarget != null ? formatMoney(deltaVsTarget) : '—'}
                    </span>
                  </div>
                </div>
              </div>

              <SaleAttachmentsSection organizationId={sale.organization_id} saleId={sale.id} />

              <DialogFooter>
                <Button variant="destructive" onClick={onDelete} disabled={isDeleting}>
                  Excluir venda
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Button variant="ghost" onClick={onDelete} disabled={isDeleting}>
            Excluir
          </Button>
        </div>
      </div>
    </div>
  )
}

