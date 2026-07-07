/** Rótulos de negócio para os campos unit_price e unit_cost_snapshot nas vendas. */

export function saleIndustryCostLabel(qtyUnit: 'kg' | 'un'): string {
  return `Custo indústria (${qtyUnit})`
}

export function saleRepresentativeCostLabel(qtyUnit: 'kg' | 'un'): string {
  return `Custo representante (${qtyUnit})`
}

export const SALE_INDUSTRY_COST_SHORT = 'Custo indústria'
export const SALE_REPRESENTATIVE_COST_SHORT = 'Custo representante'

export const SALE_INDUSTRY_COST_INVALID = 'Custo indústria inválido em uma das linhas.'
export const SALE_REPRESENTATIVE_COST_INVALID = 'Custo representante inválido em uma das linhas.'
