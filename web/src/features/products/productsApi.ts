import { supabase } from '../../app/supabaseClient'

export type PricingMode = 'markup' | 'target_margin' | 'both'

export type QtyUnit = 'kg' | 'un'

export type PricingRule = {
  unit: QtyUnit
  mode: PricingMode
  markup_percent: number | null
  target_margin_percent: number | null
}

export type Product = {
  id: string
  organization_id: string
  name: string
  unit: string
  weight_per_unit_kg: number | null
  is_active: boolean
  created_at: string
  latest_cost_kg?: { cost: number; effective_date: string } | null
  latest_cost_un?: { cost: number; effective_date: string } | null
  pricing_rule_kg?: Omit<PricingRule, 'unit'> | null
  pricing_rule_un?: Omit<PricingRule, 'unit'> | null
  sale_price_kg: number | null
  sale_price_un: number | null
  target_profit_kg: number | null
  target_profit_un: number | null
}

export async function fetchProducts(organizationId: string): Promise<Product[]> {
  const { data, error } = await supabase
    .from('products')
    .select(
      `
      id,
      organization_id,
      name,
      unit,
      weight_per_unit_kg,
      is_active,
      created_at,
      product_costs ( cost, unit, effective_date ),
      product_pricing_rules ( unit, mode, markup_percent, target_margin_percent )
      ,product_sale_prices ( unit, price )
      ,product_profit_targets ( unit, target_profit_amount )
    `,
    )
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: true })
    .order('effective_date', { referencedTable: 'product_costs', ascending: false })
    .limit(20, { referencedTable: 'product_costs' })

  if (error) throw error

  return (data ?? []).map((row) => {
    const costs = (row.product_costs ?? []) as Array<{ cost: number; unit: QtyUnit; effective_date: string }>
    const rules = (row.product_pricing_rules ?? []) as Array<{
      unit: QtyUnit
      mode: unknown
      markup_percent: number | null
      target_margin_percent: number | null
    }>

    const latestCostKg = costs.find((c) => c.unit === 'kg') ?? null
    const latestCostUn = costs.find((c) => c.unit === 'un') ?? null
    const prices = (row.product_sale_prices ?? []) as Array<{ unit: QtyUnit; price: number }>
    const priceKg = prices.find((p) => p.unit === 'kg')?.price ?? null
    const priceUn = prices.find((p) => p.unit === 'un')?.price ?? null
    const targets = (row.product_profit_targets ?? []) as Array<{ unit: QtyUnit; target_profit_amount: number }>
    const targetKg = targets.find((t) => t.unit === 'kg')?.target_profit_amount ?? null
    const targetUn = targets.find((t) => t.unit === 'un')?.target_profit_amount ?? null

    const ruleKg = rules.find((r) => r.unit === 'kg') ?? null
    const ruleUn = rules.find((r) => r.unit === 'un') ?? null
    return {
      id: row.id as string,
      organization_id: row.organization_id as string,
      name: row.name as string,
      unit: row.unit as string,
      weight_per_unit_kg: (row.weight_per_unit_kg as number | null) ?? null,
      is_active: row.is_active as boolean,
      created_at: row.created_at as string,
      latest_cost_kg: latestCostKg,
      latest_cost_un: latestCostUn,
      pricing_rule_kg: ruleKg
        ? {
            mode: (ruleKg.mode as PricingMode) ?? 'both',
            markup_percent: ruleKg.markup_percent,
            target_margin_percent: ruleKg.target_margin_percent,
          }
        : null,
      pricing_rule_un: ruleUn
        ? {
            mode: (ruleUn.mode as PricingMode) ?? 'both',
            markup_percent: ruleUn.markup_percent,
            target_margin_percent: ruleUn.target_margin_percent,
          }
        : null,
      sale_price_kg: priceKg,
      sale_price_un: priceUn,
      target_profit_kg: targetKg,
      target_profit_un: targetUn,
    }
  })
}

export async function upsertSalePrice(input: {
  organization_id: string
  product_id: string
  unit: QtyUnit
  price: number
}) {
  const { error } = await supabase.from('product_sale_prices').upsert(
    {
      organization_id: input.organization_id,
      product_id: input.product_id,
      unit: input.unit,
      price: input.price,
    },
    { onConflict: 'product_id,unit' },
  )
  if (error) throw error
}

export async function upsertProfitTarget(input: {
  organization_id: string
  product_id: string
  unit: QtyUnit
  target_profit_amount: number
}) {
  const { error } = await supabase.from('product_profit_targets').upsert(
    {
      organization_id: input.organization_id,
      product_id: input.product_id,
      unit: input.unit,
      target_profit_amount: input.target_profit_amount,
    },
    { onConflict: 'product_id,unit' },
  )
  if (error) throw error
}

export async function createProduct(input: {
  organization_id: string
  name: string
  unit: string
}): Promise<{ id: string }> {
  const { data, error } = await supabase
    .from('products')
    .insert({ organization_id: input.organization_id, name: input.name, unit: input.unit })
    .select('id')
    .single()

  if (error) throw error
  return { id: data.id as string }
}

export async function updateProduct(input: {
  id: string
  organization_id: string
  name: string
  unit: string
  weight_per_unit_kg: number | null
  is_active: boolean
}) {
  const { error } = await supabase
    .from('products')
    .update({
      name: input.name,
      unit: input.unit,
      weight_per_unit_kg: input.weight_per_unit_kg,
      is_active: input.is_active,
    })
    .eq('id', input.id)
    .eq('organization_id', input.organization_id)

  if (error) throw error
}

export async function addCost(input: {
  organization_id: string
  product_id: string
  cost: number
  unit: QtyUnit
  effective_date: string
}) {
  const { error } = await supabase.from('product_costs').upsert(
    {
      organization_id: input.organization_id,
      product_id: input.product_id,
      cost: input.cost,
      unit: input.unit,
      effective_date: input.effective_date,
    },
    { onConflict: 'product_id,unit,effective_date' },
  )
  if (error) throw error
}

export async function upsertPricingRule(input: {
  organization_id: string
  product_id: string
  unit: QtyUnit
  mode: PricingMode
  markup_percent: number | null
  target_margin_percent: number | null
}) {
  const { error } = await supabase.from('product_pricing_rules').upsert(
    {
      organization_id: input.organization_id,
      product_id: input.product_id,
      unit: input.unit,
      mode: input.mode,
      markup_percent: input.markup_percent,
      target_margin_percent: input.target_margin_percent,
    },
    { onConflict: 'product_id,unit' },
  )

  if (error) throw error
}

