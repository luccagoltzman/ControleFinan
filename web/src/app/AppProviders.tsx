import { QueryClientProvider } from '@tanstack/react-query'
import type { PropsWithChildren } from 'react'
import { queryClient } from './queryClient'
import { AuthProvider } from './auth/AuthProvider'
import { OrgProvider } from './org/OrgProvider'

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <OrgProvider>{children}</OrgProvider>
      </AuthProvider>
    </QueryClientProvider>
  )
}

