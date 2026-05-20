import { supabase } from '../../app/supabaseClient'
import { removeStoragePaths } from './saleAttachmentsApi'

export type Sale = {
  id: string
  organization_id: string
  /** Várias linhas com o mesmo `order_id` = um pedido com vários produtos. */
  order_id: string | null
  product_id: string
  region_id: string | null
  /** Segundo CD/região no mesmo pedido (opcional). */
  region_id_2: string | null
  sold_at: string
  qty: number
  qty_unit: 'kg' | 'un'
  unit_price: number
  unit_cost_snapshot: number
  /** % sobre custo total da linha, gravado no lançamento */
  commission_percent_snapshot: number
  commission_amount: number
  notes: string | null
  created_at: string
  product?: { name: string } | null
  region?: { name: string } | null
  region_secondary?: { name: string } | null
}

const SALE_COLUMNS_BASE =
  'id, organization_id, order_id, product_id, region_id, sold_at, qty, qty_unit, unit_price, unit_cost_snapshot, commission_percent_snapshot, commission_amount, notes, created_at, products ( name ), regions!region_id ( name )'

const SALE_COLUMNS_WITH_REGION_2 = `${SALE_COLUMNS_BASE.replace('region_id,', 'region_id, region_id_2,')}, region_secondary:regions!region_id_2 ( name )`

function mapSaleRow(row: Record<string, unknown>): Sale {
  return {
    id: row.id as string,
    organization_id: row.organization_id as string,
    order_id: (row.order_id as string | null | undefined) ?? null,
    product_id: row.product_id as string,
    region_id: (row.region_id as string | null) ?? null,
    region_id_2: (row.region_id_2 as string | null | undefined) ?? null,
    sold_at: row.sold_at as string,
    qty: row.qty as number,
    qty_unit: (row.qty_unit as 'kg' | 'un') ?? 'kg',
    unit_price: row.unit_price as number,
    unit_cost_snapshot: row.unit_cost_snapshot as number,
    commission_percent_snapshot: Number(row.commission_percent_snapshot ?? 0),
    commission_amount: Number(row.commission_amount ?? 0),
    notes: (row.notes as string | null) ?? null,
    created_at: row.created_at as string,
    product: (row.products as { name: string } | null) ?? null,
    region: (row.regions as { name: string } | null) ?? null,
    region_secondary: (row.region_secondary as { name: string } | null) ?? null,
  }
}

function isRegion2SchemaError(err: { message?: string } | null): boolean {
  const msg = (err?.message ?? '').toLowerCase()
  return (
    msg.includes('region_id_2') ||
    msg.includes('region_secondary') ||
    msg.includes('sales_region_id_2') ||
    msg.includes('could not find') ||
    msg.includes('schema cache')
  )
}

export async function fetchSales(input: {
  organizationId: string
  fromIso?: string
  toIso?: string
}): Promise<Sale[]> {
  async function run(select: string) {
    let q = supabase
      .from('sales')
      .select(select)
      .eq('organization_id', input.organizationId)
      .order('sold_at', { ascending: false })

    if (input.fromIso) q = q.gte('sold_at', input.fromIso)
    if (input.toIso) q = q.lt('sold_at', input.toIso)
    return q
  }

  let { data, error } = await run(SALE_COLUMNS_WITH_REGION_2)

  if (error && isRegion2SchemaError(error)) {
    const legacy = await run(SALE_COLUMNS_BASE)
    data = legacy.data
    error = legacy.error
  }

  if (error) throw error

  return (data ?? []).map((row) => mapSaleRow(row as unknown as Record<string, unknown>))
}

export async function createSale(input: {
  organization_id: string
  order_id?: string | null
  product_id: string
  region_id: string | null
  region_id_2?: string | null
  sold_at: string
  qty: number
  qty_unit: 'kg' | 'un'
  unit_price: number
  unit_cost_snapshot: number
  commission_percent_snapshot: number
  commission_amount: number
  notes: string | null
}) {
  const { order_id, region_id_2, ...rest } = input
  const row: Record<string, unknown> = { ...rest }
  if (order_id != null && order_id !== '') row.order_id = order_id
  if (region_id_2 != null && region_id_2 !== '') row.region_id_2 = region_id_2
  const { error } = await supabase.from('sales').insert(row)
  if (error) throw error
}

export async function createSaleOrder(input: {
  organization_id: string
  order_id: string
  region_id: string | null
  region_id_2: string | null
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
}) {
  if (input.lines.length === 0) return
  const rows = input.lines.map((l) => ({
    organization_id: input.organization_id,
    order_id: input.order_id,
    region_id: input.region_id,
    region_id_2: input.region_id_2 || null,
    sold_at: input.sold_at,
    notes: input.notes,
    product_id: l.product_id,
    qty: l.qty,
    qty_unit: l.qty_unit,
    unit_price: l.unit_price,
    unit_cost_snapshot: l.unit_cost_snapshot,
    commission_percent_snapshot: l.commission_percent_snapshot,
    commission_amount: l.commission_amount,
  }))
  let { error } = await supabase.from('sales').insert(rows)
  if (error && isRegion2SchemaError(error) && input.region_id_2) {
    throw new Error(
      'Segunda região não disponível no banco. Aplique a migration 022_sales_second_region.sql no Supabase.',
    )
  }
  if (error && isRegion2SchemaError(error)) {
    const legacyRows = rows.map(({ region_id_2: _r2, ...r }) => r)
    const retry = await supabase.from('sales').insert(legacyRows)
    error = retry.error
  }
  if (error) throw error
}

export type SaleLinePayload = {
  id?: string
  product_id: string
  qty: number
  qty_unit: 'kg' | 'un'
  unit_price: number
  unit_cost_snapshot: number
  commission_percent_snapshot: number
  commission_amount: number
}

export async function updateSale(input: {
  organization_id: string
  id: string
  product_id: string
  region_id: string | null
  region_id_2?: string | null
  sold_at: string
  qty: number
  qty_unit: 'kg' | 'un'
  unit_price: number
  unit_cost_snapshot: number
  commission_percent_snapshot: number
  commission_amount: number
  notes: string | null
}) {
  const { region_id_2, ...rest } = input
  const patch: Record<string, unknown> = { ...rest }
  if (region_id_2 !== undefined) {
    patch.region_id_2 = region_id_2 && region_id_2 !== '' ? region_id_2 : null
  }
  let { error } = await supabase
    .from('sales')
    .update(patch)
    .eq('organization_id', input.organization_id)
    .eq('id', input.id)

  if (error && isRegion2SchemaError(error) && input.region_id_2) {
    throw new Error(
      'Segunda região não disponível no banco. Aplique a migration 022_sales_second_region.sql no Supabase.',
    )
  }
  if (error && isRegion2SchemaError(error) && region_id_2 !== undefined) {
    const { region_id_2: _r2, ...legacyPatch } = patch
    const retry = await supabase
      .from('sales')
      .update(legacyPatch)
      .eq('organization_id', input.organization_id)
      .eq('id', input.id)
    error = retry.error
  }
  if (error) throw error
}

/** Atualiza pedido completo: campos comuns + linhas (atualiza, insere novas, remove excluídas). */
export async function updateSaleOrder(input: {
  organization_id: string
  order_id: string | null
  region_id: string | null
  region_id_2: string | null
  sold_at: string
  notes: string | null
  lines: SaleLinePayload[]
  removed_sale_ids: string[]
}) {
  for (const id of input.removed_sale_ids) {
    await deleteSale({ organization_id: input.organization_id, id })
  }

  const orderId = input.order_id

  for (const line of input.lines) {
    const row = {
      organization_id: input.organization_id,
      order_id: orderId,
      region_id: input.region_id,
      region_id_2: input.region_id_2 || null,
      sold_at: input.sold_at,
      notes: input.notes,
      product_id: line.product_id,
      qty: line.qty,
      qty_unit: line.qty_unit,
      unit_price: line.unit_price,
      unit_cost_snapshot: line.unit_cost_snapshot,
      commission_percent_snapshot: line.commission_percent_snapshot,
      commission_amount: line.commission_amount,
    }

    if (line.id) {
      await updateSale({
        organization_id: input.organization_id,
        id: line.id,
        product_id: line.product_id,
        region_id: input.region_id,
        region_id_2: input.region_id_2,
        sold_at: input.sold_at,
        qty: line.qty,
        qty_unit: line.qty_unit,
        unit_price: line.unit_price,
        unit_cost_snapshot: line.unit_cost_snapshot,
        commission_percent_snapshot: line.commission_percent_snapshot,
        commission_amount: line.commission_amount,
        notes: input.notes,
      })
    } else {
      const { error } = await supabase.from('sales').insert(row)
      if (error && isRegion2SchemaError(error) && input.region_id_2) {
        throw new Error(
          'Segunda região não disponível no banco. Aplique a migration 022_sales_second_region.sql no Supabase.',
        )
      }
      if (error && isRegion2SchemaError(error)) {
        const { region_id_2: _r2, ...legacyRow } = row
        const retry = await supabase.from('sales').insert(legacyRow)
        if (retry.error) throw retry.error
      } else if (error) {
        throw error
      }
    }
  }
}

export async function deleteSaleGroup(input: { organization_id: string; saleIds: string[] }) {
  const ids = [...new Set(input.saleIds)].filter(Boolean)
  for (const id of ids) {
    await deleteSale({ organization_id: input.organization_id, id })
  }
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
