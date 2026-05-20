import type { Product } from '../features/products/productsApi'

/** % de comissão: produto sobrescreve organização. */
export function effectiveCommissionPercent(
  product: Pick<Product, 'commission_percent'> | null,
  orgDefaultPercent: number | null,
): number {
  if (!product) return 0
  if (product.commission_percent != null) return product.commission_percent
  return orgDefaultPercent ?? 0
}

export function targetProfitPerUnit(
  product: Pick<Product, 'target_profit_kg' | 'target_profit_un'> | null,
  qtyUnit: 'kg' | 'un',
): number | null {
  if (!product) return null
  return qtyUnit === 'kg' ? product.target_profit_kg : product.target_profit_un
}

/** Base da comissão = custo total da linha (qtd × custo unitário snapshot). */
export function saleCommissionBase(input: { qty: number; unitCostSnapshot: number }): {
  totalCost: number
  base: number
} {
  const totalCost = input.qty * input.unitCostSnapshot
  const base = Math.max(0, totalCost)
  return { totalCost, base }
}

export function computeSaleCommissionAmount(input: {
  qty: number
  unitCostSnapshot: number
  product: Pick<Product, 'commission_percent'> | null
  orgDefaultPercent: number | null
}): {
  commissionPercent: number
  commissionAmount: number
  totalCost: number
  commissionBase: number
} {
  const commissionPercent = effectiveCommissionPercent(input.product, input.orgDefaultPercent)
  const { totalCost, base } = saleCommissionBase({
    qty: input.qty,
    unitCostSnapshot: input.unitCostSnapshot,
  })
  const commissionAmount = commissionAmountFromBase(base, commissionPercent)
  return { commissionPercent, commissionAmount, totalCost, commissionBase: base }
}

/** Valor da comissão a partir da base e do percentual (arredondamento em centavos). */
export function commissionAmountFromBase(base: number, commissionPercent: number): number {
  return Math.round((Math.max(0, base) * commissionPercent) / 100 * 100) / 100
}

/**
 * Comissão da linha a partir dos snapshots gravados (custo × % da venda).
 * Use na listagem/KPIs para ficar alinhado ao custo exibido; ao salvar, `computeSaleCommissionAmount` grava o valor.
 */
export function commissionAmountFromSaleLine(input: {
  qty: number
  unitCostSnapshot: number
  commissionPercentSnapshot: number
}): number {
  const base = input.qty * input.unitCostSnapshot
  return commissionAmountFromBase(base, input.commissionPercentSnapshot)
}
