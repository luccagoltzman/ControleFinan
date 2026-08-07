import type { PropsWithChildren } from 'react'
import { Navigate } from 'react-router-dom'
import { InteractivePageLoader } from '../../components/loading/InteractivePageLoader'
import { useOrg } from '../org/useOrg'

export function RequireOrganization({ children }: PropsWithChildren) {
  const { isLoading, memberships, activeOrgId, error } = useOrg()

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

  if (error) {
    return (
      <div className="mx-auto max-w-lg rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-sm">
        <p className="font-semibold text-destructive">Não foi possível carregar a organização</p>
        <p className="mt-2 text-muted-foreground">{error}</p>
        <p className="mt-3 text-muted-foreground">
          Se o erro for de rede, confirme se o projeto Supabase está ativo e se a URL em produção está correta.
        </p>
      </div>
    )
  }

  if (memberships.length === 0) return <Navigate to="/app/org" replace />
  if (!activeOrgId) return <Navigate to="/app/org" replace />
  if (!memberships.some((m) => m.organization_id === activeOrgId)) return <Navigate to="/app/org" replace />

  return children
}

