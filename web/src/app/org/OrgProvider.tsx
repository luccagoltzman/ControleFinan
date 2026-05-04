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
    .select(
      'organization_id, role, organizations ( id, name, default_commission_percent, brand_color, logo_storage_path, branding_updated_at )',
    )
    .order('created_at', { ascending: true })

  if (error) throw error

  return (data ?? []).map((row) => {
    const rawOrg = (row as unknown as { organizations?: unknown }).organizations
    const org =
      rawOrg && Array.isArray(rawOrg)
        ? (rawOrg[0] as { id?: string; name?: string } | undefined)
        : (rawOrg as { id?: string; name?: string } | null | undefined)

    const o = org as
      | {
          id?: string
          name?: string
          default_commission_percent?: number | null
          brand_color?: string | null
          logo_storage_path?: string | null
          branding_updated_at?: string
        }
      | undefined

    return {
      organization_id: row.organization_id as string,
      role: row.role as OrgMembership['role'],
      organization: {
        id: o?.id ?? (row.organization_id as string),
        name: o?.name ?? 'Organização',
        default_commission_percent: o?.default_commission_percent ?? null,
        brand_color: o?.brand_color ?? null,
        logo_storage_path: o?.logo_storage_path ?? null,
        branding_updated_at: (o?.branding_updated_at as string) ?? new Date(0).toISOString(),
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
    retry: 2,
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

  const activeOrganization = useMemo(() => {
    if (!activeOrgId) return null
    const m = (membershipsQuery.data ?? []).find((x) => x.organization_id === activeOrgId)
    return m?.organization ?? null
  }, [activeOrgId, membershipsQuery.data])

  const value = useMemo(
    () => ({
      isLoading: membershipsQuery.isLoading,
      error: membershipsQuery.isError
        ? (membershipsQuery.error instanceof Error ? membershipsQuery.error.message : String(membershipsQuery.error))
        : null,
      memberships: membershipsQuery.data ?? [],
      activeOrgId,
      activeOrganization,
      setActiveOrgId,
      refresh,
    }),
    [activeOrgId, activeOrganization, membershipsQuery.data, membershipsQuery.isError, membershipsQuery.error, membershipsQuery.isLoading],
  )

  return <OrgContext value={value}>{children}</OrgContext>
}

