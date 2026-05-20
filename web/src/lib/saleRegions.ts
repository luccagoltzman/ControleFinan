import type { Sale } from '../features/sales/salesApi'

export function formatSaleRegions(sale: Pick<Sale, 'region' | 'region_secondary'>): string {
  const a = sale.region?.name
  const b = sale.region_secondary?.name
  if (a && b) return `${a} + ${b}`
  if (a) return a
  if (b) return b
  return ''
}

/** Venda pertence ao filtro de região se qualquer CD do pedido coincidir. */
export function saleMatchesRegionFilter(
  sale: Pick<Sale, 'region_id' | 'region_id_2'>,
  regionId: string,
): boolean {
  return sale.region_id === regionId || sale.region_id_2 === regionId
}

/** IDs de região presentes na venda (para filtros e mapa). */
export function saleRegionIds(sale: Pick<Sale, 'region_id' | 'region_id_2'>): string[] {
  const ids: string[] = []
  if (sale.region_id) ids.push(sale.region_id)
  if (sale.region_id_2 && sale.region_id_2 !== sale.region_id) ids.push(sale.region_id_2)
  return ids
}
