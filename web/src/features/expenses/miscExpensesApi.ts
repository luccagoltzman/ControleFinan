import { supabase } from '../../app/supabaseClient'

export type MiscExpense = {
  id: string
  organization_id: string
  spent_at: string
  amount: number
  description: string
  split_with_partner: boolean
  created_at: string
}

export async function fetchMiscExpenses(input: {
  organizationId: string
  fromIso: string
  toIso: string
}): Promise<MiscExpense[]> {
  const { data, error } = await supabase
    .from('misc_expenses')
    .select('id, organization_id, spent_at, amount, description, split_with_partner, created_at')
    .eq('organization_id', input.organizationId)
    .gte('spent_at', input.fromIso)
    .lt('spent_at', input.toIso)
    .order('spent_at', { ascending: false })

  if (error) throw error

  return (data ?? []).map((row) => ({
    id: row.id as string,
    organization_id: row.organization_id as string,
    spent_at: row.spent_at as string,
    amount: Number(row.amount),
    description: (row.description as string) ?? '',
    split_with_partner: Boolean(row.split_with_partner),
    created_at: row.created_at as string,
  }))
}

export async function createMiscExpense(input: {
  organization_id: string
  spent_at: string
  amount: number
  description: string
  split_with_partner: boolean
}) {
  const { error } = await supabase.from('misc_expenses').insert({
    organization_id: input.organization_id,
    spent_at: input.spent_at,
    amount: input.amount,
    description: input.description.trim() || 'Despesa',
    split_with_partner: input.split_with_partner,
  })
  if (error) throw error
}

export async function updateMiscExpense(input: {
  organization_id: string
  id: string
  spent_at?: string
  amount?: number
  description?: string
  split_with_partner?: boolean
}) {
  const patch: Record<string, unknown> = {}
  if (input.spent_at !== undefined) patch.spent_at = input.spent_at
  if (input.amount !== undefined) patch.amount = input.amount
  if (input.description !== undefined) patch.description = input.description.trim() || 'Despesa'
  if (input.split_with_partner !== undefined) patch.split_with_partner = input.split_with_partner

  const { error } = await supabase
    .from('misc_expenses')
    .update(patch)
    .eq('id', input.id)
    .eq('organization_id', input.organization_id)

  if (error) throw error
}

export async function deleteMiscExpense(input: { organization_id: string; id: string }) {
  const { error } = await supabase
    .from('misc_expenses')
    .delete()
    .eq('organization_id', input.organization_id)
    .eq('id', input.id)
  if (error) throw error
}
