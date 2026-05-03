import { supabase } from '../../app/supabaseClient'
import { removeStoragePaths } from './saleAttachmentsApi'

export type Sale = {
  id: string
  organization_id: string
  product_id: string
  region_id: string | null
  sold_at: string
  qty: number
  qty_unit: 'kg' | 'un'
  unit_price: number
  unit_cost_snapshot: number
  notes: string | null
  created_at: string
  product?: { name: string } | null
  region?: { name: string } | null
}

export async function fetchSales(input: {
  organizationId: string
  fromIso?: string
  toIso?: string
}): Promise<Sale[]> {
  let q = supabase
    .from('sales')
    .select(
      'id, organization_id, product_id, region_id, sold_at, qty, qty_unit, unit_price, unit_cost_snapshot, notes, created_at, products ( name ), regions ( name )',
    )
    .eq('organization_id', input.organizationId)
    .order('sold_at', { ascending: false })

  if (input.fromIso) q = q.gte('sold_at', input.fromIso)
  if (input.toIso) q = q.lt('sold_at', input.toIso)

  const { data, error } = await q
  if (error) throw error

  return (data ?? []).map((row) => ({
    id: row.id as string,
    organization_id: row.organization_id as string,
    product_id: row.product_id as string,
    region_id: (row.region_id as string | null) ?? null,
    sold_at: row.sold_at as string,
    qty: row.qty as number,
    qty_unit: (row.qty_unit as 'kg' | 'un') ?? 'kg',
    unit_price: row.unit_price as number,
    unit_cost_snapshot: row.unit_cost_snapshot as number,
    notes: (row.notes as string | null) ?? null,
    created_at: row.created_at as string,
    product: (row as unknown as { products?: { name: string } | null }).products ?? null,
    region: (row as unknown as { regions?: { name: string } | null }).regions ?? null,
  }))
}

export async function createSale(input: {
  organization_id: string
  product_id: string
  region_id: string | null
  sold_at: string
  qty: number
  qty_unit: 'kg' | 'un'
  unit_price: number
  unit_cost_snapshot: number
  notes: string | null
}) {
  const { error } = await supabase.from('sales').insert(input)
  if (error) throw error
}

export async function deleteSale(input: { organization_id: string; id: string }) {
  const { data: pathsRows, error: pathsErr } = await supabase
    .from('sale_attachments')
    .select('storage_path')
    .eq('organization_id', input.organization_id)
    .eq('sale_id', input.id)

  if (pathsErr) throw pathsErr
  const paths = (pathsRows ?? []).map((r) => r.storage_path as string).filter(Boolean)
  if (paths.length) await removeStoragePaths(paths)

  const { error } = await supabase
    .from('sales')
    .delete()
    .eq('organization_id', input.organization_id)
    .eq('id', input.id)
  if (error) throw error
}

