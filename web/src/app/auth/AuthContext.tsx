import type { Session, User } from '@supabase/supabase-js'
import { createContext } from 'react'

export type AuthState = {
  isLoading: boolean
  session: Session | null
  user: User | null
}

export const AuthContext = createContext<AuthState | undefined>(undefined)

