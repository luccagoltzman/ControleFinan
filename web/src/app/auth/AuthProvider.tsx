import type { PropsWithChildren } from 'react'
import { useEffect, useMemo, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../supabaseClient'
import { AuthContext } from './AuthContext'

export function AuthProvider({ children }: PropsWithChildren) {
  const [isLoading, setIsLoading] = useState(true)
  const [session, setSession] = useState<Session | null>(null)

  useEffect(() => {
    let isMounted = true

    supabase.auth.getSession().then(({ data, error }) => {
      if (!isMounted) return
      if (error) {
        setSession(null)
      } else {
        setSession(data.session ?? null)
      }
      setIsLoading(false)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
    })

    return () => {
      isMounted = false
      sub.subscription.unsubscribe()
    }
  }, [])

  const value = useMemo(
    () => ({
      isLoading,
      session,
      user: session?.user ?? null,
    }),
    [isLoading, session],
  )

  return <AuthContext value={value}>{children}</AuthContext>
}

