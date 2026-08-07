import type { Session, User } from '@supabase/supabase-js'
import { createContext } from 'react'

export type AuthState = {
  isLoading: boolean
  /** Erro de sessão/conectividade (ex.: Supabase inacessível). */
  error: string | null
  session: Session | null
  user: User | null
}

export const AuthContext = createContext<AuthState | undefined>(undefined)
