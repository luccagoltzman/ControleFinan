import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Pencil, Trash2 } from 'lucide-react'
import type { Product } from '../products/productsApi'
import type { Sale, SalePaymentStatus } from './salesApi'
import { Button } from '../../components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../../components/ui/dialog'
import { formatMoney } from '../../lib/money'
import { formatSaleRegions } from '../../lib/saleRegions'
import { parseSaleTaxInput } from '../../lib/saleTax'
import {
  orderCommission,
  orderFirstLineId,
  orderNetAfterTax,
  orderPaidAt,
  orderPaymentStatus,
  orderProfit,
  orderProfitPlusCommission,
  orderTaxAmount,
  orderTaxPercent,
} from '../../lib/saleOrderMetrics'
import { SaleTaxFields, loadSaleTaxDrafts } from './SaleTaxFields'
import { SaleAttachmentsSection } from './SaleAttachmentsSection'
import { SALE_INDUSTRY_COST_SHORT, SALE_REPRESENTATIVE_COST_SHORT } from '../../lib/saleFieldLabels'
import { SALE_PAYMENT_LABELS, salePaymentBadgeClass } from '../../lib/salePayment'

function OrderMetric({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="rounded-lg bg-muted/40 px-3 py-2">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
      <div
        className={`mt-0.5 text-sm font-semibold tabular-nums ${highlight ? 'text-emerald-700 dark:text-emerald-400' : 'text-foreground'}`}
      >
        {value}
      </div>
    </div>
  )
}

export function SalesOrderCard({
  lines,
  products,
  onEdit,
  onDeleteGroup,
  onDeleteLine,
  onSaveTax,
  onTogglePayment,
  isSavingTax,
  isSavingPayment,
  isDeletingGroup,
  isDeletingLine,
  renderLineReport,
}: {
  lines: Sale[]
  products: Product[]
  onEdit: () => void
  onDeleteGroup: () => void
  onDeleteLine: (id: string) => void
  onSaveTax: (
    lineIds: string[],
    tax: { tax_amount: number | null; tax_percent_snapshot: number | null },
  ) => Promise<unknown>
  onTogglePayment: (firstLineId: string, nextStatus: SalePaymentStatus) => Promise<unknown>
  isSavingTax: boolean
  isSavingPayment: boolean
  isDeletingGroup: boolean
  isDeletingLine: boolean
  renderLineReport: (sale: Sale, product: Product | null) => ReactNode
}) {
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [taxDraftPercent, setTaxDraftPercent] = useState('')
  const [taxDraftAmount, setTaxDraftAmount] = useState('')
  const [taxError, setTaxError] = useState<string | null>(null)

  const first = lines[0]!
  const multi = lines.length > 1
  const sortedLines = useMemo(
    () => [...lines].sort((a, b) => a.created_at.localeCompare(b.created_at)),
    [lines],
  )

  const revenue = lines.reduce((acc, s) => acc + s.qty * s.unit_price, 0)
  const cost = lines.reduce((acc, s) => acc + s.qty * s.unit_cost_snapshot, 0)
  const profit = orderProfit(lines)
  const commission = orderCommission(lines)
  const profitPlusCommission = orderProfitPlusCommission(lines)
  const tax = orderTaxAmount(lines)
  const taxPct = orderTaxPercent(lines)
  const netAfterTax = orderNetAfterTax(lines)
  const margin = revenue > 0 ? (profit / revenue) * 100 : 0
  const paymentStatus = orderPaymentStatus(lines)
  const paidAt = orderPaidAt(lines)
  const firstLineId = orderFirstLineId(lines)

  const productNames = lines.map((s) => s.product?.name ?? 'Produto')
  const title = multi ? `Pedido com ${lines.length} produtos` : productNames[0]!
  const dateStr = new Date(first.sold_at).toLocaleDateString('pt-BR')
  const regions = formatSaleRegions(first)

  useEffect(() => {
    if (detailsOpen) {
      const drafts = loadSaleTaxDrafts({
        tax_amount: tax > 0 ? tax : null,
        tax_percent_snapshot: taxPct,
      })
      setTaxDraftPercent(drafts.percent)
      setTaxDraftAmount(drafts.amount)
      setTaxError(null)
    }
  }, [detailsOpen, tax, taxPct])

  return (
    <article className="rounded-xl border border-border/70 bg-card p-4 shadow-sm transition-colors hover:border-border">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <time className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">{dateStr}</time>
            <span className={`rounded-md border px-2 py-0.5 text-xs font-medium ${salePaymentBadgeClass(paymentStatus)}`}>
              {SALE_PAYMENT_LABELS[paymentStatus]}
            </span>
            {regions ? (
              <span className="rounded-md border border-border px-2 py-0.5 text-xs text-muted-foreground">{regions}</span>
            ) : null}
            <span className="rounded-md border border-border px-2 py-0.5 text-xs text-muted-foreground">
              Margem {margin.toFixed(1).replace('.', ',')}%
            </span>
          </div>

          <h3 className="text-base font-semibold leading-snug text-foreground">{title}</h3>

          {multi ? (
            <ul className="space-y-1 text-sm text-muted-foreground">
              {productNames.slice(0, 4).map((name, i) => (
                <li key={`${name}-${i}`} className="flex gap-2">
                  <span className="text-muted-foreground/60">•</span>
                  <span className="line-clamp-1">{name}</span>
                </li>
              ))}
              {productNames.length > 4 ? (
                <li className="text-xs text-muted-foreground">+ {productNames.length - 4} produto(s)</li>
              ) : null}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              {first.qty} {first.qty_unit} · {SALE_INDUSTRY_COST_SHORT} {formatMoney(first.unit_price)} · {SALE_REPRESENTATIVE_COST_SHORT} {formatMoney(first.unit_cost_snapshot)}
            </p>
          )}

          {first.notes ? (
            <p className="line-clamp-2 text-xs text-muted-foreground italic">{first.notes}</p>
          ) : null}
          {paidAt ? (
            <p className="text-xs text-muted-foreground">
              Pago em {new Date(paidAt).toLocaleString('pt-BR')}
            </p>
          ) : null}
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-1 lg:justify-end">
          <Button
            variant={paymentStatus === 'paid' ? 'outline' : 'default'}
            size="sm"
            disabled={isSavingPayment || isDeletingGroup || isDeletingLine}
            onClick={() =>
              onTogglePayment(firstLineId, paymentStatus === 'paid' ? 'pending' : 'paid')
            }
          >
            {isSavingPayment ? 'Salvando…' : paymentStatus === 'paid' ? 'Marcar pendente' : 'Marcar pago'}
          </Button>
          <Button variant="outline" size="sm" onClick={onEdit} disabled={isDeletingGroup || isDeletingLine}>
            <Pencil className="mr-1.5 h-3.5 w-3.5" aria-hidden />
            Editar
          </Button>
          <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                Detalhes
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{multi ? 'Relatório do pedido' : 'Relatório da venda'}</DialogTitle>
                <DialogDescription>
                  {dateStr}
                  {regions ? ` · ${regions}` : ''}
                </DialogDescription>
              </DialogHeader>

              {first.notes ? (
                <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                  {first.notes}
                </p>
              ) : null}

              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-muted/30 p-3">
                <div>
                  <div className="text-xs text-muted-foreground">Pagamento</div>
                  <div className={`mt-1 inline-flex rounded-md border px-2 py-0.5 text-sm font-medium ${salePaymentBadgeClass(paymentStatus)}`}>
                    {SALE_PAYMENT_LABELS[paymentStatus]}
                  </div>
                  {paidAt ? (
                    <div className="mt-1 text-xs text-muted-foreground">
                      {new Date(paidAt).toLocaleString('pt-BR')}
                    </div>
                  ) : null}
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant={paymentStatus === 'paid' ? 'outline' : 'default'}
                  disabled={isSavingPayment || isDeletingGroup || isDeletingLine}
                  onClick={() =>
                    onTogglePayment(firstLineId, paymentStatus === 'paid' ? 'pending' : 'paid')
                  }
                >
                  {isSavingPayment ? 'Salvando…' : paymentStatus === 'paid' ? 'Marcar pendente' : 'Marcar pago'}
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-3 rounded-lg border border-border bg-muted/30 p-3 text-sm sm:grid-cols-3 lg:grid-cols-6">
                <div>
                  <div className="text-xs text-muted-foreground">Lucro</div>
                  <div className="font-semibold">{formatMoney(profit)}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Comissão</div>
                  <div className="font-semibold">{formatMoney(commission)}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Lucro + comissão</div>
                  <div className="font-semibold text-emerald-800">{formatMoney(profitPlusCommission)}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Imposto</div>
                  <div className="font-semibold">
                    {formatMoney(tax)}
                    {taxPct != null && taxPct > 0 ? (
                      <span className="text-xs font-normal text-muted-foreground">
                        {' '}
                        ({taxPct.toFixed(2).replace('.', ',')}%)
                      </span>
                    ) : null}
                  </div>
                </div>
                <div className="col-span-2 sm:col-span-1 lg:col-span-2">
                  <div className="text-xs text-muted-foreground">Líquido após imposto</div>
                  <div className="font-semibold text-emerald-800">{formatMoney(netAfterTax)}</div>
                </div>
              </div>

              <div className="rounded-lg border border-border bg-card p-4">
                <div className="mb-3 text-sm font-semibold">Imposto sobre lucro + comissão</div>
                <SaleTaxFields
                  baseAmount={profitPlusCommission}
                  percent={taxDraftPercent}
                  amount={taxDraftAmount}
                  onPercentChange={setTaxDraftPercent}
                  onAmountChange={setTaxDraftAmount}
                />
                {taxError ? <p className="mt-2 text-sm text-destructive">{taxError}</p> : null}
                <Button
                  type="button"
                  className="mt-3"
                  size="sm"
                  disabled={isSavingTax || isDeletingGroup || isDeletingLine}
                  onClick={async () => {
                    setTaxError(null)
                    const parsed = parseSaleTaxInput({
                      baseAmount: profitPlusCommission,
                      percentRaw: taxDraftPercent,
                      amountRaw: taxDraftAmount,
                    })
                    if (!parsed.ok) {
                      setTaxError(parsed.error)
                      return
                    }
                    try {
                      await onSaveTax(sortedLines.map((s) => s.id), parsed.tax)
                    } catch (e) {
                      setTaxError(e instanceof Error ? e.message : 'Erro ao salvar imposto')
                    }
                  }}
                >
                  {isSavingTax ? 'Salvando…' : 'Salvar imposto'}
                </Button>
              </div>

              <div className="space-y-6">
                {lines.map((sale) => {
                  const product = products.find((p) => p.id === sale.product_id) ?? null
                  return (
                    <div key={sale.id} className="space-y-3 border-b border-border pb-6 last:border-0 last:pb-0">
                      {renderLineReport(sale, product)}
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
                <Button
                  variant="outline"
                  onClick={() => {
                    setDetailsOpen(false)
                    onEdit()
                  }}
                  disabled={isDeletingGroup || isDeletingLine}
                >
                  <Pencil className="mr-1 h-4 w-4" aria-hidden />
                  Editar
                </Button>
                <Button variant="destructive" onClick={onDeleteGroup} disabled={isDeletingGroup || isDeletingLine}>
                  Excluir {multi ? 'pedido inteiro' : 'venda'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={onDeleteGroup}
            disabled={isDeletingGroup || isDeletingLine}
          >
            <Trash2 className="h-4 w-4" aria-hidden />
            <span className="sr-only">Excluir</span>
          </Button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-7">
        <OrderMetric label="Receita" value={formatMoney(revenue)} />
        <OrderMetric label="Custo" value={formatMoney(cost)} />
        <OrderMetric label="Lucro" value={formatMoney(profit)} />
        <OrderMetric label="Comissão" value={formatMoney(commission)} />
        <OrderMetric label="Lucro + com." value={formatMoney(profitPlusCommission)} highlight />
        <OrderMetric
          label="Imposto"
          value={
            taxPct != null && taxPct > 0
              ? `${formatMoney(tax)} (${taxPct.toFixed(1).replace('.', ',')}%)`
              : formatMoney(tax)
          }
        />
        <OrderMetric label="Líquido" value={formatMoney(netAfterTax)} highlight />
      </div>
    </article>
  )
}
