import type { PropsWithChildren } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { InteractivePageLoader } from '../../components/loading/InteractivePageLoader'
import { useAuth } from '../auth/useAuth'

export function RequireAuth({ children }: PropsWithChildren) {
  const { isLoading, user } = useAuth()
  const location = useLocation()

  if (isLoading) {
    return (
      <InteractivePageLoader
        variant="fullscreen"
        message="Abrindo sua sessão…"
        tips={[
          'Verificando credenciais com segurança…',
          'Só um instante — quase no painel.',
        ]}
      />
    )
  }

  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />

  return children
}

