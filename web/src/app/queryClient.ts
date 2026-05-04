import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      // Ajuda bastante em cenários PWA: ao voltar para o app, refaz fetch (evita “dados faltando” por estado antigo)
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      staleTime: 30_000,
    },
  },
})

