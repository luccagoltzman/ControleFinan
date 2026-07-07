import { commissionAmountFromSaleLine } from './saleCommission'
import type { Sale } from '../features/sales/salesApi'

export function lineProfit(sale: Pick<Sale, 'qty' | 'unit_price' | 'unit_cost_snapshot'>): number {
  return sale.qty * (sale.unit_price - sale.unit_cost_snapshot)
}

export function lineCommission(
  sale: Pick<Sale, 'qty' | 'unit_cost_snapshot' | 'commission_percent_snapshot'>,
): number {
  return commissionAmountFromSaleLine({
    qty: sale.qty,
    unitCostSnapshot: sale.unit_cost_snapshot,
    commissionPercentSnapshot: sale.commission_percent_snapshot,
  })
}

export function orderProfit(lines: Sale[]): number {
  return lines.reduce((acc, s) => acc + lineProfit(s), 0)
}

export function orderCommission(lines: Sale[]): number {
  return lines.reduce((acc, s) => acc + lineCommission(s), 0)
}

export function orderProfitPlusCommission(lines: Sale[]): number {
  return orderProfit(lines) + orderCommission(lines)
}

/** Imposto do pedido (primeira linha com valor ou primeira linha do grupo). */
export function orderTaxAmount(lines: Pick<Sale, 'tax_amount'>[]): number {
  const withTax = lines.find((l) => l.tax_amount != null)
  return Number(withTax?.tax_amount ?? 0)
}

export function orderTaxPercent(lines: Pick<Sale, 'tax_percent_snapshot'>[]): number | null {
  const withPct = lines.find((l) => l.tax_percent_snapshot != null)
  return withPct?.tax_percent_snapshot ?? null
}

export function orderNetAfterTax(lines: Sale[]): number {
  return orderProfitPlusCommission(lines) - orderTaxAmount(lines)
}

/** Status de pagamento do pedido (primeira linha do grupo). */
export function orderPaymentStatus(lines: Pick<Sale, 'payment_status' | 'created_at'>[]): Sale['payment_status'] {
  const sorted = [...lines].sort((a, b) => a.created_at.localeCompare(b.created_at))
  const paid = sorted.find((l) => l.payment_status === 'paid')
  if (paid) return 'paid'
  return sorted[0]?.payment_status ?? 'pending'
}

export function orderPaidAt(lines: Pick<Sale, 'paid_at' | 'created_at' | 'payment_status'>[]): string | null {
  const sorted = [...lines].sort((a, b) => a.created_at.localeCompare(b.created_at))
  return sorted.find((l) => l.payment_status === 'paid')?.paid_at ?? sorted[0]?.paid_at ?? null
}

export function orderFirstLineId(lines: Pick<Sale, 'id' | 'created_at'>[]): string {
  return [...lines].sort((a, b) => a.created_at.localeCompare(b.created_at))[0]!.id
}
