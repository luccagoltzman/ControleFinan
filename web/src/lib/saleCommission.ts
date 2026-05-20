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

/**
 * Base da comissão = receita da linha − alvo total (qtd × alvo por unidade).
 * Sem alvo cadastrado, usa a receita inteira (comportamento anterior).
 * Valor negativo é tratado como 0 para o cálculo da comissão.
 */
export function saleCommissionBase(input: {
  qty: number
  unitPrice: number
  qtyUnit: 'kg' | 'un'
  targetProfitKg: number | null
  targetProfitUn: number | null
}): { revenue: number; targetTotal: number | null; base: number } {
  const revenue = input.qty * input.unitPrice
  const perUnit = input.qtyUnit === 'kg' ? input.targetProfitKg : input.targetProfitUn
  const targetTotal = perUnit != null ? input.qty * perUnit : null
  const rawBase = targetTotal != null ? revenue - targetTotal : revenue
  const base = Math.max(0, rawBase)
  return { revenue, targetTotal, base }
}

export function computeSaleCommissionAmount(input: {
  qty: number
  unitPrice: number
  qtyUnit: 'kg' | 'un'
  product: Pick<
    Product,
    'commission_percent' | 'target_profit_kg' | 'target_profit_un'
  > | null
  orgDefaultPercent: number | null
}): {
  commissionPercent: number
  commissionAmount: number
  revenue: number
  targetTotal: number | null
  commissionBase: number
} {
  const commissionPercent = effectiveCommissionPercent(input.product, input.orgDefaultPercent)
  const { revenue, targetTotal, base } = saleCommissionBase({
    qty: input.qty,
    unitPrice: input.unitPrice,
    qtyUnit: input.qtyUnit,
    targetProfitKg: input.product?.target_profit_kg ?? null,
    targetProfitUn: input.product?.target_profit_un ?? null,
  })
  const commissionAmount = Math.round((base * commissionPercent) / 100 * 100) / 100
  return { commissionPercent, commissionAmount, revenue, targetTotal, commissionBase: base }
}
