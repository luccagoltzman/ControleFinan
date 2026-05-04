import { useEffect } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { Button } from '../ui/button'
import { cn } from '../../lib/cn'

const CHECK_UPDATE_MS = 60 * 60 * 1000

/**
 * PWA: verificação periódica e ao voltar ao separador para detetar novos builds;
 * banner explícito para aplicar atualização (modo prompt do vite-plugin-pwa).
 */
export function PwaUpdateBanner() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    immediate: true,
  })

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    const onVisible = () => {
      if (document.visibilityState !== 'visible') return
      void navigator.serviceWorker.getRegistration().then((r) => r?.update())
    }

    document.addEventListener('visibilitychange', onVisible)

    let intervalId: ReturnType<typeof setInterval> | undefined
    let cancelled = false

    void navigator.serviceWorker.ready.then((reg) => {
      if (cancelled) return
      const check = () => void reg.update()
      intervalId = window.setInterval(check, CHECK_UPDATE_MS)
    })

    return () => {
      cancelled = true
      if (intervalId != null) window.clearInterval(intervalId)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])

  if (!needRefresh) return null

  return (
    <div
      role="status"
      className={cn(
        'fixed bottom-0 left-0 right-0 z-[100] border-t border-border bg-card px-4 py-3 shadow-[0_-4px_24px_rgba(0,0,0,0.08)]',
        'pb-[max(0.75rem,env(safe-area-inset-bottom))]',
      )}
    >
      <div className="container-app flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <p className="text-sm text-foreground">
          <span className="font-medium">Nova versão disponível.</span>{' '}
          <span className="text-muted-foreground">Atualize para carregar o código e o cache mais recentes.</span>
        </p>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setNeedRefresh(false)
            }}
          >
            Depois
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => {
              void updateServiceWorker(true)
            }}
          >
            Atualizar agora
          </Button>
        </div>
      </div>
    </div>
  )
}
