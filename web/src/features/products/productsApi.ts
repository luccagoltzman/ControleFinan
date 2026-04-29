import { supabase } from '../../app/supabaseClient'

export type PricingMode = 'markup' | 'target_margin' | 'both'

export type Product = {
  id: string
  organization_id: string
  name: string
  unit: string
  is_active: boolean
  created_at: string
  latest_cost?: { cost: number; effective_date: string } | null
  pricing_rule?: {
    mode: PricingMode
    markup_percent: number | null
    target_margin_percent: number | null
  } | null
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
      is_active,
      created_at,
      product_costs ( cost, effective_date ),
      product_pricing_rules ( mode, markup_percent, target_margin_percent )
    `,
    )
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: true })
    .order('effective_date', { referencedTable: 'product_costs', ascending: false })
    .limit(1, { referencedTable: 'product_costs' })

  if (error) throw error

  return (data ?? []).map((row) => {
    const costs = (row.product_costs ?? []) as Array<{ cost: number; effective_date: string }>
    const rules = (row.product_pricing_rules ?? []) as Array<{
      mode: unknown
      markup_percent: number | null
      target_margin_percent: number | null
    }>

    const rule = rules[0]
    return {
      id: row.id as string,
      organization_id: row.organization_id as string,
      name: row.name as string,
      unit: row.unit as string,
      is_active: row.is_active as boolean,
      created_at: row.created_at as string,
      latest_cost: costs[0] ?? null,
      pricing_rule: rule
        ? {
            mode: (rule.mode as PricingMode) ?? 'both',
            markup_percent: rule.markup_percent,
            target_margin_percent: rule.target_margin_percent,
          }
        : null,
    }
  })
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
  is_active: boolean
}) {
  const { error } = await supabase
    .from('products')
    .update({ name: input.name, unit: input.unit, is_active: input.is_active })
    .eq('id', input.id)
    .eq('organization_id', input.organization_id)

  if (error) throw error
}

export async function addCost(input: {
  organization_id: string
  product_id: string
  cost: number
  effective_date: string
}) {
  const { error } = await supabase.from('product_costs').insert({
    organization_id: input.organization_id,
    product_id: input.product_id,
    cost: input.cost,
    effective_date: input.effective_date,
  })
  if (error) throw error
}

export async function upsertPricingRule(input: {
  organization_id: string
  product_id: string
  mode: PricingMode
  markup_percent: number | null
  target_margin_percent: number | null
}) {
  const { error } = await supabase.from('product_pricing_rules').upsert(
    {
      organization_id: input.organization_id,
      product_id: input.product_id,
      mode: input.mode,
      markup_percent: input.markup_percent,
      target_margin_percent: input.target_margin_percent,
    },
    { onConflict: 'product_id' },
  )

  if (error) throw error
}

