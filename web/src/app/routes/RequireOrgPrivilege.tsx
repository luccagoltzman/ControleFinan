import type { PropsWithChildren } from 'react'
import { Navigate } from 'react-router-dom'
import { InteractivePageLoader } from '../../components/loading/InteractivePageLoader'
import { useOrg } from '../org/useOrg'
import { isPrivilegedOrgRole } from '../../lib/orgPrivileges'

/** Apenas owner/admin (folha salarial, despesas avulsas, auditoria). */
export function RequireOrgPrivilege({ children }: PropsWithChildren) {
  const { isLoading, memberships, activeOrgId } = useOrg()

  if (isLoading) {
    return (
      <InteractivePageLoader
        variant="embedded"
        message="Carregando permissões…"
        tips={['Confirmando seu papel na organização…']}
      />
    )
  }

  if (!activeOrgId) return <Navigate to="/app/org" replace />
  const role = memberships.find((m) => m.organization_id === activeOrgId)?.role

  if (!isPrivilegedOrgRole(role)) {
    return <Navigate to="/app/dashboard" replace />
  }

  return children
}
