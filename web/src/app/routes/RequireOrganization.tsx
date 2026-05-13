import type { PropsWithChildren } from 'react'
import { Navigate } from 'react-router-dom'
import { InteractivePageLoader } from '../../components/loading/InteractivePageLoader'
import { useOrg } from '../org/useOrg'

export function RequireOrganization({ children }: PropsWithChildren) {
  const { isLoading, memberships, activeOrgId } = useOrg()

  if (isLoading) {
    return (
      <InteractivePageLoader
        variant="embedded"
        message="Carregando organização…"
        tips={[
          'Buscando empresas e permissões da sua conta…',
          'Preparando o contexto para os dados financeiros…',
        ]}
      />
    )
  }

  if (memberships.length === 0) return <Navigate to="/app/org" replace />
  if (!activeOrgId) return <Navigate to="/app/org" replace />
  if (!memberships.some((m) => m.organization_id === activeOrgId)) return <Navigate to="/app/org" replace />

  return children
}

