import type { PropsWithChildren } from 'react'
import { Navigate } from 'react-router-dom'
import { useOrg } from '../org/useOrg'

export function RequireOrganization({ children }: PropsWithChildren) {
  const { isLoading, memberships, activeOrgId } = useOrg()

  if (isLoading) {
    return <div className="text-sm text-slate-600">Carregando organização…</div>
  }

  if (memberships.length === 0) return <Navigate to="/app/org" replace />
  if (!activeOrgId) return <Navigate to="/app/org" replace />

  return children
}

