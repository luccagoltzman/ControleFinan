import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { PropsWithChildren } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../auth/useAuth'
import { supabase } from '../supabaseClient'
import { OrgContext, type OrgMembership } from './OrgContext'
import { getStoredActiveOrgId, setStoredActiveOrgId } from './orgStorage'

const membershipsQueryKey = ['org', 'memberships']

async function fetchMemberships(): Promise<OrgMembership[]> {
  const { data, error } = await supabase
    .from('organization_members')
    .select('organization_id, role, organizations ( id, name )')
    .order('created_at', { ascending: true })

  if (error) throw error

  return (data ?? []).map((row) => {
    const rawOrg = (row as unknown as { organizations?: unknown }).organizations
    const org =
      rawOrg && Array.isArray(rawOrg)
        ? (rawOrg[0] as { id?: string; name?: string } | undefined)
        : (rawOrg as { id?: string; name?: string } | null | undefined)

    return {
      organization_id: row.organization_id as string,
      role: row.role as OrgMembership['role'],
      organization: {
        id: org?.id ?? (row.organization_id as string),
        name: org?.name ?? 'Organização',
      },
    }
  })
}

export function OrgProvider({ children }: PropsWithChildren) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [activeOrgId, setActiveOrgIdState] = useState<string | null>(() => getStoredActiveOrgId())

  const membershipsQuery = useQuery({
    queryKey: membershipsQueryKey,
    queryFn: fetchMemberships,
    enabled: !!user,
  })

  useEffect(() => {
    if (!membershipsQuery.data) return

    const memberships = membershipsQuery.data
    if (memberships.length === 0) return

    const exists = memberships.some((m) => m.organization_id === activeOrgId)
    if (activeOrgId && exists) return

    const firstOrgId = memberships[0]!.organization_id
    setActiveOrgIdState(firstOrgId)
    setStoredActiveOrgId(firstOrgId)
  }, [activeOrgId, membershipsQuery.data])

  function setActiveOrgId(orgId: string) {
    setActiveOrgIdState(orgId)
    setStoredActiveOrgId(orgId)
  }

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: membershipsQueryKey })
    await queryClient.refetchQueries({ queryKey: membershipsQueryKey, exact: true })
  }

  const value = useMemo(
    () => ({
      isLoading: membershipsQuery.isLoading,
      memberships: membershipsQuery.data ?? [],
      activeOrgId,
      setActiveOrgId,
      refresh,
    }),
    [activeOrgId, membershipsQuery.data, membershipsQuery.isLoading],
  )

  return <OrgContext value={value}>{children}</OrgContext>
}

