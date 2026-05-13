import { useMutation, useQuery } from '@tanstack/react-query'
import { useMemo, useState, type ChangeEvent } from 'react'
import { useOrg } from '../../app/org/useOrg'
import { queryClient } from '../../app/queryClient'
import { PageHeader } from '../../components/PageHeader'
import { InteractivePageLoader } from '../../components/loading/InteractivePageLoader'
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
import { fetchProducts, type Product } from '../products/productsApi'
import { createSaleOrder, deleteSale, deleteSaleGroup, fetchSales, type Sale } from './salesApi'
import { SaleAttachmentsSection } from './SaleAttachmentsSection'
import { fetchRegions } from '../regions/regionsApi'
import { Plus, Trash2 } from 'lucide-react'

type SaleLineDraft = {
  key: string
  product_id: string
  qty_unit: 'kg' | 'un'
  qty: string
  unit_price: string
  unit_cost_snapshot: string
}

function newSaleLine(): SaleLineDraft {
  return {
    key: crypto.randomUUID(),
    product_id: '',
    qty_unit: 'kg',
    qty: '',
    unit_price: '',
    unit_cost_snapshot: '',
  }
}

function effectiveCommissionPercent(product: Product | null, orgDefault: number | null): number {
  if (!product) return 0
  if (product.commission_percent != null) return product.commission_percent
  return orgDefault ?? 0
}

function monthRange(monthYYYYMM: string) {
  const [y, m] = monthYYYYMM.split('-').map(Number)
  const from = new Date(Date.UTC(y!, (m! - 1)!, 1, 0, 0, 0))
  const to = new Date(Date.UTC(y!, m!, 1, 0, 0, 0))
  return { fromIso: from.toISOString(), toIso: to.toISOString() }
}

/** Agrupa linhas pelo pedido (`order_id`) ou cada venda antiga isolada (`id`). */
function groupSalesByOrder(sales: Sale[]) {
  const m = new Map<string, Sale[]>()
  for (const s of sales) {
    const key = s.order_id ?? s.id
    const arr = m.get(key) ?? []
    arr.push(s)
    m.set(key, arr)
  }
  return Array.from(m.values())
    .map((lines) => [...lines].sort((a, b) => a.created_at.localeCompare(b.created_at)))
    .sort((a, b) => new Date(b[0]!.sold_at).getTime() - new Date(a[0]!.sold_at).getTime())
}

export function SalesPage() {
  const { activeOrgId, memberships } = useOrg()
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7))
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const [createOpen, setCreateOpen] = useState(false)
  const [regionId, setRegionId] = useState('')
  const [soldDate, setSoldDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [notes, setNotes] = useState('')
  const [lines, setLines] = useState<SaleLineDraft[]>(() => [newSaleLine()])

  const { fromIso, toIso } = useMemo(() => monthRange(month), [month])

  const orgDefaultCommission = useMemo(() => {
    const m = memberships.find((x) => x.organization_id === activeOrgId)
    return m?.organization.default_commission_percent ?? null
  }, [memberships, activeOrgId])

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

  const products = productsQuery.data ?? []

  const createMutation = useMutation({
    mutationFn: (input: {
      region_id: string | null
      sold_at: string
      notes: string | null
      lines: Array<{
        product_id: string
        qty: number
        qty_unit: 'kg' | 'un'
        unit_price: number
        unit_cost_snapshot: number
        commission_percent_snapshot: number
        commission_amount: number
      }>
    }) =>
      createSaleOrder({
        organization_id: activeOrgId!,
        order_id: crypto.randomUUID(),
        region_id: input.region_id,
        sold_at: input.sold_at,
        notes: input.notes,
        lines: input.lines,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['sales'] })
    },
  })

  const deleteGroupMutation = useMutation({
    mutationFn: (saleIds: string[]) => deleteSaleGroup({ organization_id: activeOrgId!, saleIds }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['sales'] })
    },
  })

  const deleteLineMutation = useMutation({
    mutationFn: (id: string) => deleteSale({ organization_id: activeOrgId!, id }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['sales'] })
    },
  })

  function computeSuggestedCostSnapshot(productId: string, nextQtyUnit: 'kg' | 'un') {
    const p = products.find((x) => x.id === productId)
    if (!p) return null
    const costKg = p.latest_cost_kg?.cost ?? null
    const costUn = p.latest_cost_un?.cost ?? null
    if (nextQtyUnit === 'kg') return costKg ?? null
    return costUn ?? null
  }

  function computeSuggestedUnitPrice(productId: string, nextQtyUnit: 'kg' | 'un') {
    const p = products.find((x) => x.id === productId)
    if (!p) return null
    const cost = computeSuggestedCostSnapshot(productId, nextQtyUnit)
    if (cost == null) return null
    const target = nextQtyUnit === 'kg' ? p.target_profit_kg : p.target_profit_un
    if (target == null) return null
    return cost + target
  }

  function updateLine(key: string, patch: Partial<SaleLineDraft>) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)))
  }

  function onPickProduct(lineKey: string, productId: string, current: SaleLineDraft) {
    const nextUnit = current.qty_unit
    const patch: Partial<SaleLineDraft> = { product_id: productId }
    const suggested = computeSuggestedCostSnapshot(productId, nextUnit)
    if (suggested != null) patch.unit_cost_snapshot = String(suggested).replace('.', ',')
    const suggestedPrice = computeSuggestedUnitPrice(productId, nextUnit)
    if (!current.unit_price?.trim() && suggestedPrice != null) {
      patch.unit_price = String(suggestedPrice).replace('.', ',')
    }
    updateLine(lineKey, patch)
  }

  async function onSubmitCreate() {
    setErrorMsg(null)
    const filled = lines.filter((l) => l.product_id.trim() !== '')
    if (filled.length === 0) {
      setErrorMsg('Inclua pelo menos um produto com quantidade e valores.')
      return
    }

    const payloadLines: Array<{
      product_id: string
      qty: number
      qty_unit: 'kg' | 'un'
      unit_price: number
      unit_cost_snapshot: number
      commission_percent_snapshot: number
      commission_amount: number
    }> = []

    for (const l of filled) {
      const qty = parseNumberPtBr(l.qty)
      const unitPrice = parseMoneyPtBr(l.unit_price)
      const unitCost = parseMoneyPtBr(l.unit_cost_snapshot)
      if (qty == null || qty <= 0) {
        setErrorMsg('Quantidade inválida em uma das linhas.')
        return
      }
      if (unitPrice == null) {
        setErrorMsg('Preço unitário inválido em uma das linhas.')
        return
      }
      if (unitCost == null) {
        setErrorMsg('Custo (snapshot) inválido em uma das linhas.')
        return
      }
      const prod = products.find((p) => p.id === l.product_id) ?? null
      const commissionPct = effectiveCommissionPercent(prod, orgDefaultCommission)
      const revenue = qty * unitPrice
      const commissionAmount = Math.round((revenue * commissionPct) / 100 * 100) / 100
      payloadLines.push({
        product_id: l.product_id,
        qty,
        qty_unit: l.qty_unit,
        unit_price: unitPrice,
        unit_cost_snapshot: unitCost,
        commission_percent_snapshot: commissionPct,
        commission_amount: commissionAmount,
      })
    }

    const sold_at = new Date(`${soldDate}T12:00:00`).toISOString()
    const rid = regionId.trim() ? regionId.trim() : null
    const notesTrim = notes.trim() ? notes.trim() : null

    try {
      await createMutation.mutateAsync({
        region_id: rid,
        sold_at,
        notes: notesTrim,
        lines: payloadLines,
      })
      const n = payloadLines.length
      toast({
        title: n > 1 ? 'Pedido salvo' : 'Venda salva',
        description:
          n > 1
            ? `${n} produtos no mesmo pedido • ${new Date(sold_at).toLocaleDateString('pt-BR')}`
            : `${payloadLines[0]!.qty} ${payloadLines[0]!.qty_unit} registados.`,
      })
      setLines([newSaleLine()])
      setNotes('')
      setCreateOpen(false)
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Erro ao salvar pedido')
    }
  }

  const totals = useMemo(() => {
    const sales = salesQuery.data ?? []
    const revenue = sales.reduce((acc, s) => acc + s.qty * s.unit_price, 0)
    const cost = sales.reduce((acc, s) => acc + s.qty * s.unit_cost_snapshot, 0)
    const profit = revenue - cost
    const margin = revenue > 0 ? profit / revenue : 0
    const commission = sales.reduce((acc, s) => acc + s.commission_amount, 0)
    return { revenue, cost, profit, margin, commission }
  }, [salesQuery.data])

  const orderGroups = useMemo(() => groupSalesByOrder(salesQuery.data ?? []), [salesQuery.data])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Vendas"
        description="Registre pedidos com um ou vários produtos; comissão continua sobre a receita de cada linha (qtd × preço)."
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

      {salesQuery.isLoading ? (
        <InteractivePageLoader
          variant="embedded"
          message="Carregando vendas…"
          tips={['Somando pedidos e comissões do período…', 'Organizando linhas por data…']}
        />
      ) : (
        <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Cadastros</CardTitle>
            <div className="text-sm text-muted-foreground">
              Um pedido pode incluir vários produtos (mesma data, região e observações).
            </div>
          </div>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button>Novo lançamento</Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Novo pedido / venda</DialogTitle>
                <DialogDescription>
                  Preencha os dados comuns e adicione uma linha por produto. Use &quot;Adicionar produto&quot; para mais itens no
                  mesmo pedido.
                </DialogDescription>
              </DialogHeader>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
                <div className="md:col-span-4">
                  <Label>Região</Label>
                  <select
                    className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={regionId}
                    onChange={(e) => setRegionId(e.target.value)}
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
                  <Label>Data</Label>
                  <Input className="mt-1" type="date" value={soldDate} onChange={(e) => setSoldDate(e.target.value)} />
                </div>
                <div className="md:col-span-3" />
                <div className="md:col-span-12">
                  <Label>Observações (todo o pedido)</Label>
                  <Textarea className="mt-1" placeholder="Cliente, NF, detalhes…" value={notes} onChange={(e) => setNotes(e.target.value)} />
                </div>
              </div>

              <div className="mt-4 space-y-4">
                {lines.map((line, index) => {
                  const selectedProduct = products.find((p) => p.id === line.product_id) ?? null
                  return (
                    <div key={line.key} className="rounded-lg border border-border bg-muted/20 p-4">
                      <div className="mb-3 flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold">Produto {index + 1}</span>
                        {lines.length > 1 ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-destructive"
                            onClick={() => setLines((prev) => prev.filter((l) => l.key !== line.key))}
                          >
                            <Trash2 className="h-4 w-4" aria-hidden />
                            Remover linha
                          </Button>
                        ) : null}
                      </div>
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
                        <div className="md:col-span-6">
                          <Label>Produto</Label>
                          <select
                            className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                            value={line.product_id}
                            onChange={(e) => onPickProduct(line.key, e.target.value, line)}
                          >
                            <option value="">Selecione…</option>
                            {products.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="md:col-span-3">
                          <Label>Unidade</Label>
                          <select
                            className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                            value={line.qty_unit}
                            onChange={(e) => {
                              const next = e.target.value as 'kg' | 'un'
                              updateLine(line.key, { qty_unit: next })
                              if (line.product_id) {
                                const suggested = computeSuggestedCostSnapshot(line.product_id, next)
                                if (suggested != null) {
                                  updateLine(line.key, { unit_cost_snapshot: String(suggested).replace('.', ',') })
                                }
                                const suggestedPrice = computeSuggestedUnitPrice(line.product_id, next)
                                if (!line.unit_price?.trim() && suggestedPrice != null) {
                                  updateLine(line.key, { unit_price: String(suggestedPrice).replace('.', ',') })
                                }
                              }
                            }}
                          >
                            <option value="kg">kg</option>
                            <option value="un">un</option>
                          </select>
                        </div>
                        <div className="md:col-span-3">
                          <Label>Qtd. ({line.qty_unit})</Label>
                          <Input
                            className="mt-1"
                            inputMode="decimal"
                            placeholder="0"
                            value={line.qty}
                            onChange={(e) => updateLine(line.key, { qty: e.target.value })}
                          />
                        </div>
                        <div className="md:col-span-6">
                          <MoneyInput
                            label={`Preço por ${line.qty_unit}`}
                            value={line.unit_price}
                            onChange={(e) => updateLine(line.key, { unit_price: e.target.value })}
                          />
                          {selectedProduct ? (
                            <div className="mt-1 text-xs text-muted-foreground">
                              Sugestão:{' '}
                              {(() => {
                                const cost =
                                  line.qty_unit === 'kg'
                                    ? (selectedProduct.latest_cost_kg?.cost ?? null)
                                    : (selectedProduct.latest_cost_un?.cost ?? null)
                                const target =
                                  line.qty_unit === 'kg' ? selectedProduct.target_profit_kg : selectedProduct.target_profit_un
                                if (cost == null || target == null) return '—'
                                return formatMoney(cost + target)
                              })()}
                            </div>
                          ) : null}
                        </div>
                        <div className="md:col-span-6">
                          <MoneyInput
                            label="Custo (snapshot)"
                            value={line.unit_cost_snapshot}
                            onChange={(e) => updateLine(line.key, { unit_cost_snapshot: e.target.value })}
                          />
                        </div>
                        {selectedProduct ? (
                          <div className="md:col-span-12 rounded-md border border-border bg-background/80 px-3 py-2 text-xs text-muted-foreground">
                            Comissão % (esta linha):{' '}
                            {effectiveCommissionPercent(selectedProduct, orgDefaultCommission).toFixed(2).replace('.', ',')}%
                            {selectedProduct.commission_percent != null ? ' (produto)' : ' (organização)'}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  )
                })}
              </div>

              <Button
                type="button"
                variant="outline"
                className="mt-2 w-full sm:w-auto"
                onClick={() => setLines((prev) => [...prev, newSaleLine()])}
              >
                <Plus className="mr-2 h-4 w-4" aria-hidden />
                Adicionar produto
              </Button>

              {errorMsg ? <div className="mt-3 text-sm text-destructive">{errorMsg}</div> : null}

              <DialogFooter className="mt-4">
                <Button type="button" onClick={onSubmitCreate} disabled={createMutation.isPending}>
                  Salvar pedido
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
      </Card>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Kpi title="Faturamento" value={formatMoney(totals.revenue)} />
        <Kpi title="Custo (snapshot)" value={formatMoney(totals.cost)} />
        <Kpi title="Lucro bruto" value={formatMoney(totals.profit)} />
        <Kpi title="Comissão" value={formatMoney(totals.commission)} />
        <Kpi title="Margem" value={`${(totals.margin * 100).toFixed(2)}%`} />
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Vendas do mês</CardTitle>
        </CardHeader>
        <CardContent>
          {salesQuery.isError ? (
            <div className="text-sm text-rose-700">
              Erro ao carregar vendas.{' '}
              <span className="text-muted-foreground">
                {(salesQuery.error instanceof Error ? salesQuery.error.message : String(salesQuery.error)) ?? ''}
              </span>
            </div>
          ) : orderGroups.length === 0 ? (
            <div className="text-sm text-muted-foreground">Nenhuma venda registrada neste mês.</div>
          ) : (
            <div className="divide-y divide-border rounded-md border border-border">
              {orderGroups.map((groupLines) => (
                <SaleOrderRow
                  key={groupLines[0]!.order_id ?? groupLines[0]!.id}
                  lines={groupLines}
                  products={products}
                  onDeleteGroup={() => deleteGroupMutation.mutate(groupLines.map((s) => s.id))}
                  onDeleteLine={(id) => deleteLineMutation.mutate(id)}
                  isDeletingGroup={deleteGroupMutation.isPending}
                  isDeletingLine={deleteLineMutation.isPending}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
        </>
      )}
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

function centsLabel(value: number) {
  const cents = Math.round(Math.abs(value) * 100)
  return `${cents} centavos`
}

function SaleLineReport({
  sale,
  product,
}: {
  sale: Sale
  product: { name: string; target_profit_kg: number | null; target_profit_un: number | null } | null
}) {
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

  return (
    <div className="grid grid-cols-1 gap-3">
      <div className="rounded-lg border border-border bg-card p-4 text-sm">
        <div className="mb-2 font-medium text-foreground">{product?.name ?? sale.product?.name ?? 'Produto'}</div>
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
          <span className="text-muted-foreground">Receita (linha)</span>
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
          <span className="text-muted-foreground">% comissão (no lançamento)</span>
          <span className="font-medium">{sale.commission_percent_snapshot.toFixed(2).replace('.', ',')}%</span>
        </div>
        <div className="mt-2 flex justify-between">
          <span className="text-muted-foreground">Valor da comissão</span>
          <span className="font-semibold">{formatMoney(sale.commission_amount)}</span>
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
                Atingiu • +{formatMoney(deltaPerUnitVsTarget)} por {unit}
              </span>
            ) : (
              <span className="font-semibold text-rose-700">
                Não atingiu • faltou {formatMoney(Math.abs(deltaPerUnitVsTarget))} por {unit}
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
      </div>
    </div>
  )
}

function SaleOrderRow({
  lines,
  products,
  onDeleteGroup,
  onDeleteLine,
  isDeletingGroup,
  isDeletingLine,
}: {
  lines: Sale[]
  products: Product[]
  onDeleteGroup: () => void
  onDeleteLine: (id: string) => void
  isDeletingGroup: boolean
  isDeletingLine: boolean
}) {
  const [detailsOpen, setDetailsOpen] = useState(false)
  const first = lines[0]!
  const multi = lines.length > 1

  const revenue = lines.reduce((acc, s) => acc + s.qty * s.unit_price, 0)
  const cost = lines.reduce((acc, s) => acc + s.qty * s.unit_cost_snapshot, 0)
  const profit = revenue - cost
  const commission = lines.reduce((acc, s) => acc + s.commission_amount, 0)

  const titleBits = lines.map((s) => s.product?.name ?? 'Produto').join(' + ')
  const dateStr = new Date(first.sold_at).toISOString().slice(0, 10)

  return (
    <div className="grid grid-cols-1 gap-2 px-3 py-2 md:grid-cols-[1.1fr_0.5fr_0.5fr_0.5fr_0.5fr_0.5fr_auto] md:items-center">
      <div>
        <div className="text-sm font-medium text-slate-900">
          {multi ? `Pedido (${lines.length} produtos)` : titleBits} • {dateStr}
        </div>
        <div className="text-xs text-slate-600">
          {multi ? (
            <span>{titleBits}</span>
          ) : (
            <>
              Qtd: {first.qty}
              {first.qty_unit ? ` ${first.qty_unit}` : ''} • Preço: {formatMoney(first.unit_price)} • Custo:{' '}
              {formatMoney(first.unit_cost_snapshot)}
            </>
          )}
          {first.region?.name ? ` • Região ${first.region.name}` : ''}
          {first.notes ? ` • ${first.notes}` : ''}
        </div>
      </div>
      <div className="text-sm text-slate-900">Receita {formatMoney(revenue)}</div>
      <div className="text-sm text-slate-900">Custo {formatMoney(cost)}</div>
      <div className="text-sm font-medium text-slate-900">Lucro {formatMoney(profit)}</div>
      <div className="text-sm text-slate-900">Com. {formatMoney(commission)}</div>
      <div className="text-sm text-slate-700">{revenue > 0 ? `${((profit / revenue) * 100).toFixed(2)}%` : '—'}</div>
      <div className="md:text-right">
        <div className="flex items-center justify-end gap-1">
          <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
            <DialogTrigger asChild>
              <Button variant="ghost">Detalhes</Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{multi ? 'Relatório do pedido' : 'Relatório da venda'}</DialogTitle>
                <DialogDescription>
                  {dateStr}
                  {first.region?.name ? ` • ${first.region.name}` : ''}
                </DialogDescription>
              </DialogHeader>

              {first.notes ? (
                <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                  {first.notes}
                </p>
              ) : null}

              <div className="space-y-6">
                {lines.map((sale) => {
                  const product = products.find((p) => p.id === sale.product_id) ?? null
                  return (
                    <div key={sale.id} className="space-y-3 border-b border-border pb-6 last:border-0 last:pb-0">
                      <SaleLineReport sale={sale} product={product} />
                      <SaleAttachmentsSection organizationId={sale.organization_id} saleId={sale.id} />
                      {multi ? (
                        <div className="flex justify-end">
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-destructive"
                            onClick={() => onDeleteLine(sale.id)}
                            disabled={isDeletingLine || isDeletingGroup}
                          >
                            Excluir só esta linha
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  )
                })}
              </div>

              <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
                <Button variant="destructive" onClick={onDeleteGroup} disabled={isDeletingGroup || isDeletingLine}>
                  Excluir {multi ? 'pedido inteiro' : 'venda'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Button variant="ghost" onClick={onDeleteGroup} disabled={isDeletingGroup || isDeletingLine}>
            Excluir
          </Button>
        </div>
      </div>
    </div>
  )
}
