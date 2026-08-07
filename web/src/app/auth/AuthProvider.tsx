import type { PropsWithChildren } from 'react'
import { useEffect, useMemo, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../supabaseClient'
import { AuthContext } from './AuthContext'

const SESSION_BOOT_TIMEOUT_MS = 8_000

function isNetworkAuthError(err: unknown): boolean {
  const msg = (err instanceof Error ? err.message : String(err ?? '')).toLowerCase()
  return (
    msg.includes('failed to fetch') ||
    msg.includes('network') ||
    msg.includes('fetch') ||
    msg.includes('timeout') ||
    msg.includes('name_not_resolved') ||
    msg.includes('err_name_not_resolved')
  )
}

function friendlyAuthError(err: unknown): string {
  if (isNetworkAuthError(err)) {
    return 'Não foi possível conectar ao servidor (Supabase). Verifique a internet ou se o projeto ainda está ativo.'
  }
  if (err instanceof Error && err.message.trim()) return err.message
  return 'Falha ao validar a sessão. Faça login novamente.'
}

async function clearLocalSession() {
  try {
    await supabase.auth.signOut({ scope: 'local' })
  } catch {
    // ignora — o objetivo é destravar a UI
  }
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [session, setSession] = useState<Session | null>(null)

  useEffect(() => {
    let isMounted = true
    let settled = false

    function finish(next: { session: Session | null; error?: string | null }) {
      if (!isMounted || settled) return
      settled = true
      setSession(next.session)
      setError(next.error ?? null)
      setIsLoading(false)
    }

    const timeoutId = window.setTimeout(() => {
      if (!isMounted || settled) return
      settled = true
      void clearLocalSession().then(() => {
        if (!isMounted) return
        setSession(null)
        setError(
          'O servidor demorou demais para responder. A sessão local foi limpa — tente entrar de novo quando a conexão estiver ok.',
        )
        setIsLoading(false)
      })
    }, SESSION_BOOT_TIMEOUT_MS)

    void supabase.auth
      .getSession()
      .then(async ({ data, error: sessionError }) => {
        window.clearTimeout(timeoutId)
        if (sessionError) {
          if (settled) return
          await clearLocalSession()
          finish({ session: null, error: friendlyAuthError(sessionError) })
          return
        }
        finish({ session: data.session ?? null, error: null })
      })
      .catch(async (err: unknown) => {
        window.clearTimeout(timeoutId)
        if (settled) return
        await clearLocalSession()
        finish({ session: null, error: friendlyAuthError(err) })
      })

    const { data: sub } = supabase.auth.onAuthStateChange(async (event, nextSession) => {
      if (!isMounted) return

      if (event === 'SIGNED_OUT') {
        setSession(null)
        setIsLoading(false)
        return
      }

      if (event === 'TOKEN_REFRESHED' && !nextSession) {
        await clearLocalSession()
        setSession(null)
        setError('Sessão expirada ou servidor indisponível. Faça login novamente.')
        setIsLoading(false)
        return
      }

      setSession(nextSession)
      if (nextSession) setError(null)
      setIsLoading(false)
    })

    return () => {
      isMounted = false
      window.clearTimeout(timeoutId)
      sub.subscription.unsubscribe()
    }
  }, [])

  const value = useMemo(
    () => ({
      isLoading,
      error,
      session,
      user: session?.user ?? null,
    }),
    [isLoading, error, session],
  )

  return <AuthContext value={value}>{children}</AuthContext>
}
