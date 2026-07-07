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
