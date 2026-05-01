import { supabase } from '../../app/supabaseClient'

export type Region = {
  id: string
  organization_id: string
  name: string
  created_at: string
}

export async function fetchRegions(organizationId: string): Promise<Region[]> {
  const { data, error } = await supabase
    .from('regions')
    .select('id, organization_id, name, created_at')
    .eq('organization_id', organizationId)
    .order('name', { ascending: true })

  if (error) throw error
  return (data ?? []).map((r) => ({
    id: r.id as string,
    organization_id: r.organization_id as string,
    name: r.name as string,
    created_at: r.created_at as string,
  }))
}

export async function createRegion(input: { organization_id: string; name: string }) {
  const { error } = await supabase.from('regions').insert({ organization_id: input.organization_id, name: input.name })
  if (error) throw error
}

export async function deleteRegion(input: { organization_id: string; id: string }) {
  const { error } = await supabase
    .from('regions')
    .delete()
    .eq('organization_id', input.organization_id)
    .eq('id', input.id)
  if (error) throw error
}

