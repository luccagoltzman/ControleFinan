import { supabase } from '../../app/supabaseClient'

export type AuditLogRow = {
  id: string
  organization_id: string
  user_id: string | null
  actor_email: string | null
  action: string
  entity_type: string
  entity_id: string | null
  metadata: Record<string, unknown>
  created_at: string
}

export async function fetchAuditLogs(input: {
  organizationId: string
  limit?: number
  offset?: number
}): Promise<AuditLogRow[]> {
  const limit = input.limit ?? 150
  const offset = input.offset ?? 0
  const hi = Math.max(0, offset + limit - 1)

  const { data, error } = await supabase
    .from('audit_logs')
    .select('id, organization_id, user_id, actor_email, action, entity_type, entity_id, metadata, created_at')
    .eq('organization_id', input.organizationId)
    .order('created_at', { ascending: false })
    .range(offset, hi)

  if (error) throw error

  return (data ?? []).map((row) => ({
    id: row.id as string,
    organization_id: row.organization_id as string,
    user_id: (row.user_id as string | null) ?? null,
    actor_email: (row.actor_email as string | null) ?? null,
    action: row.action as string,
    entity_type: row.entity_type as string,
    entity_id: (row.entity_id as string | null) ?? null,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    created_at: row.created_at as string,
  }))
}
