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
  /** Imposto sobre lucro+comissão do pedido (na 1ª linha do pedido). */
  tax_amount: number | null
  /** % do imposto sobre lucro+comissão (snapshot na 1ª linha). */
  tax_percent_snapshot: number | null
  notes: string | null
  created_at: string
  product?: { name: string } | null
  region?: { name: string } | null
  region_secondary?: { name: string } | null
}

const SALE_COLUMNS_BASE =
  'id, organization_id, order_id, product_id, region_id, sold_at, qty, qty_unit, unit_price, unit_cost_snapshot, commission_percent_snapshot, commission_amount, tax_amount, tax_percent_snapshot, notes, created_at, products ( name ), regions!region_id ( name )'

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
    tax_amount: row.tax_amount != null ? Number(row.tax_amount) : null,
    tax_percent_snapshot: row.tax_percent_snapshot != null ? Number(row.tax_percent_snapshot) : null,
    notes: (row.notes as string | null) ?? null,
    created_at: row.created_at as string,
    product: (row.products as { name: string } | null) ?? null,
    region: (row.regions as { name: string } | null) ?? null,
    region_secondary: (row.region_secondary as { name: string } | null) ?? null,
  }
}

const SALE_COLUMNS_NO_TAX = SALE_COLUMNS_BASE.replace('tax_amount, ', '').replace('tax_percent_snapshot, ', '')
const SALE_COLUMNS_WITH_REGION_2_NO_TAX = `${SALE_COLUMNS_NO_TAX.replace('region_id,', 'region_id, region_id_2,')}, region_secondary:regions!region_id_2 ( name )`

function isSchemaColumnError(err: { message?: string } | null): boolean {
  const msg = (err?.message ?? '').toLowerCase()
  return (
    msg.includes('could not find') ||
    msg.includes('schema cache') ||
    msg.includes('does not exist') ||
    msg.includes('column')
  )
}

function isTaxSchemaError(err: { message?: string } | null): boolean {
  const msg = (err?.message ?? '').toLowerCase()
  return msg.includes('tax_amount') || msg.includes('tax_percent_snapshot')
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
    if (input.toIso) q = q.lte('sold_at', input.toIso)
    if (!input.fromIso && !input.toIso) q = q.limit(10000)
    return q
  }

  const selectVariants = [
    SALE_COLUMNS_WITH_REGION_2,
    SALE_COLUMNS_WITH_REGION_2_NO_TAX,
    SALE_COLUMNS_NO_TAX,
    SALE_COLUMNS_BASE,
  ]

  let lastError: { message?: string } | null = null
  for (const select of selectVariants) {
    const { data, error } = await run(select)
    if (!error) {
      return (data ?? []).map((row) => mapSaleRow(row as unknown as Record<string, unknown>))
    }
    lastError = error
    if (!isSchemaColumnError(error)) break
  }

  if (lastError) throw lastError
  return []
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
  tax_amount?: number | null
  tax_percent_snapshot?: number | null
}) {
  const { order_id, region_id_2, tax_amount, tax_percent_snapshot, ...rest } = input
  const row: Record<string, unknown> = { ...rest }
  if (order_id != null && order_id !== '') row.order_id = order_id
  if (region_id_2 != null && region_id_2 !== '') row.region_id_2 = region_id_2
  if (tax_amount !== undefined) row.tax_amount = tax_amount
  if (tax_percent_snapshot !== undefined) row.tax_percent_snapshot = tax_percent_snapshot
  let { error } = await supabase.from('sales').insert(row)
  if (error && isTaxSchemaError(error)) {
    const { tax_amount: _a, tax_percent_snapshot: _p, ...legacyRow } = row
    const retry = await supabase.from('sales').insert(legacyRow)
    error = retry.error
  }
  if (error) throw error
}

export async function createSaleOrder(input: {
  organization_id: string
  order_id: string
  region_id: string | null
  region_id_2: string | null
  sold_at: string
  notes: string | null
  tax_amount: number | null
  tax_percent_snapshot: number | null
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
  const rows = input.lines.map((l, index) => ({
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
    tax_amount: index === 0 ? input.tax_amount : null,
    tax_percent_snapshot: index === 0 ? input.tax_percent_snapshot : null,
  }))
  let { error } = await supabase.from('sales').insert(rows)
  if (error && isTaxSchemaError(error)) {
    const legacyRows = rows.map(({ tax_amount: _a, tax_percent_snapshot: _p, ...r }) => r)
    const retry = await supabase.from('sales').insert(legacyRows)
    error = retry.error
    if (!error && (input.tax_amount != null || input.tax_percent_snapshot != null)) {
      throw new Error('Imposto não disponível no banco. Aplique as migrations 024 e 025 no Supabase.')
    }
  }
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
  tax_amount?: number | null
  tax_percent_snapshot?: number | null
}) {
  const { region_id_2, tax_amount, tax_percent_snapshot, ...rest } = input
  const patch: Record<string, unknown> = { ...rest }
  if (region_id_2 !== undefined) {
    patch.region_id_2 = region_id_2 && region_id_2 !== '' ? region_id_2 : null
  }
  if (tax_amount !== undefined) patch.tax_amount = tax_amount
  if (tax_percent_snapshot !== undefined) patch.tax_percent_snapshot = tax_percent_snapshot
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
  if (error && isTaxSchemaError(error)) {
    const { tax_amount: _a, tax_percent_snapshot: _p, ...legacyPatch } = patch
    const retry = await supabase
      .from('sales')
      .update(legacyPatch)
      .eq('organization_id', input.organization_id)
      .eq('id', input.id)
    error = retry.error
    if (!error) {
      throw new Error('Imposto não disponível no banco. Aplique as migrations 024 e 025 no Supabase.')
    }
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
  tax_amount: number | null
  tax_percent_snapshot: number | null
  lines: SaleLinePayload[]
  removed_sale_ids: string[]
}) {
  for (const id of input.removed_sale_ids) {
    await deleteSale({ organization_id: input.organization_id, id })
  }

  const orderId = input.order_id

  for (let i = 0; i < input.lines.length; i++) {
    const line = input.lines[i]!
    const lineTax = i === 0 ? input.tax_amount : null
    const lineTaxPct = i === 0 ? input.tax_percent_snapshot : null
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
      tax_amount: lineTax,
      tax_percent_snapshot: lineTaxPct,
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
        tax_amount: lineTax,
        tax_percent_snapshot: lineTaxPct,
      })
    } else {
      const { error } = await supabase.from('sales').insert(row)
      if (error && isTaxSchemaError(error)) {
        const { tax_amount: _a, tax_percent_snapshot: _p, ...legacyRow } = row
        const retry = await supabase.from('sales').insert(legacyRow)
        if (retry.error) throw retry.error
        if (input.tax_amount != null || input.tax_percent_snapshot != null) {
          throw new Error('Imposto não disponível no banco. Aplique as migrations 024 e 025 no Supabase.')
        }
      } else if (error && isRegion2SchemaError(error) && input.region_id_2) {
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

/** Atualiza só o imposto do pedido (primeira linha do grupo). */
export async function updateOrderTax(input: {
  organization_id: string
  lineIds: string[]
  tax_amount: number | null
  tax_percent_snapshot: number | null
}) {
  const ids = [...new Set(input.lineIds)].filter(Boolean)
  if (ids.length === 0) return
  const firstId = ids[0]!

  for (const id of ids) {
    const isFirst = id === firstId
    const { error } = await supabase
      .from('sales')
      .update({
        tax_amount: isFirst ? input.tax_amount : null,
        tax_percent_snapshot: isFirst ? input.tax_percent_snapshot : null,
      })
      .eq('organization_id', input.organization_id)
      .eq('id', id)

    if (error && isTaxSchemaError(error)) {
      throw new Error('Imposto não disponível no banco. Aplique as migrations 024 e 025 no Supabase.')
    }
    if (error) throw error
  }
}

/** @deprecated Use updateOrderTax */
export const updateOrderTaxAmount = updateOrderTax

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
