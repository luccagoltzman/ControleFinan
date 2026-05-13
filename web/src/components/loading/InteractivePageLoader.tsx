import { useCallback, useEffect, useId, useMemo, useState } from 'react'
import { cn } from '../../lib/cn'

const DEFAULT_TIPS = [
  'Sincronizando vendas, custos e metas…',
  'Organizando os números da sua operação…',
  'Quase lá — preparando os painéis…',
]

type Spark = { id: number; x: number; y: number }

export type InteractivePageLoaderProps = {
  message?: string
  /** `undefined` = dicas padrão; `[]` = sem dicas rotativas (só `message`) */
  tips?: string[]
  variant?: 'fullscreen' | 'embedded'
  showInteractionHint?: boolean
  className?: string
}

const barHeightsPct = [28, 55, 38, 72, 44, 63, 33]

/**
 * Loader único por tela: mini gráfico animado, dicas rotativas e interação
 * (hover acelera barras; clique cria brilho). Em `embedded`, ocupa o centro da área útil.
 */
export function InteractivePageLoader({
  message = 'Carregando…',
  tips,
  variant = 'embedded',
  showInteractionHint = true,
  className,
}: InteractivePageLoaderProps) {
  const labelId = useId()
  const [tipIndex, setTipIndex] = useState(0)
  const [sparks, setSparks] = useState<Spark[]>([])

  const resolvedTips = tips ?? DEFAULT_TIPS
  const tipsToShow = useMemo(() => resolvedTips.filter(Boolean), [resolvedTips])

  useEffect(() => {
    if (tipsToShow.length <= 1) return
    const id = window.setInterval(() => {
      setTipIndex((i) => (i + 1) % tipsToShow.length)
    }, 3200)
    return () => window.clearInterval(id)
  }, [tipsToShow])

  const pushSpark = useCallback((clientX: number, clientY: number, rect: DOMRect) => {
    const x = clientX - rect.left
    const y = clientY - rect.top
    const sparkId = Date.now() + Math.random()
    setSparks((prev) => [...prev.slice(-10), { id: sparkId, x, y }])
    window.setTimeout(() => {
      setSparks((prev) => prev.filter((s) => s.id !== sparkId))
    }, 550)
  }, [])

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    pushSpark(e.clientX, e.clientY, rect)
  }

  const isFull = variant === 'fullscreen'

  const outerShell = isFull
    ? 'min-h-screen w-full flex flex-col items-center justify-center gap-8 px-6 py-16'
    : 'flex w-full max-w-lg flex-col items-center justify-center gap-8 py-10 px-6'

  const barW = 'w-2'
  const chartH = 'h-24'
  const chartW = 'w-44'

  const body = (
    <div className={outerShell} role="status" aria-busy="true" aria-labelledby={labelId}>
      <div
        className={cn(
          'cf-loader-surface group relative cursor-pointer select-none rounded-2xl border border-primary/15 bg-gradient-to-br from-primary/[0.07] via-card to-muted/40 p-6 shadow-sm ring-1 ring-border/50 transition-shadow hover:shadow-md hover:ring-primary/25',
          chartW,
        )}
        onPointerDown={onPointerDown}
        title="Passe o mouse para acelerar • clique para um brilho"
      >
        <div
          className={cn(
            'pointer-events-none absolute inset-x-4 bottom-4 top-8 flex items-end justify-center gap-1.5',
            chartH,
          )}
        >
          {barHeightsPct.map((h, i) => (
            <div
              key={i}
              className={cn(
                barW,
                'cf-loader-bar rounded-t-md bg-primary shadow-sm transition-[filter] duration-200 will-change-transform group-hover:brightness-110',
              )}
              style={{ height: `${h}%` }}
            />
          ))}
        </div>

        <div
          className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 transition-opacity group-hover:opacity-100"
          style={{
            background:
              'linear-gradient(110deg, transparent 40%, hsl(var(--primary) / 0.08) 50%, transparent 60%)',
            backgroundSize: '200% 100%',
            animation: 'cf-loader-shimmer 2.2s ease-in-out infinite',
          }}
        />

        {sparks.map((s) => (
          <span
            key={s.id}
            className="pointer-events-none absolute h-3 w-3 rounded-full bg-primary/90 shadow-[0_0_12px_hsl(var(--primary)/0.5)]"
            style={{
              left: s.x,
              top: s.y,
              transform: 'translate(-50%, -50%)',
              animation: 'cf-loader-spark 0.5s ease-out forwards',
            }}
          />
        ))}
      </div>

      <div className="max-w-md text-center">
        <p id={labelId} className="text-base font-semibold text-foreground">
          {message}
        </p>
        {tipsToShow.length > 1 ? (
          <p key={tipIndex} className="mt-2 text-sm text-muted-foreground">
            {tipsToShow[tipIndex]}
          </p>
        ) : null}
        {showInteractionHint ? (
          <p className="mt-3 text-xs text-muted-foreground/80">
            Dica: passe o mouse sobre o gráfico para animar mais rápido.
          </p>
        ) : null}
      </div>
    </div>
  )

  if (isFull) {
    return <div className={cn('w-full', className)}>{body}</div>
  }

  return (
    <div
      className={cn(
        'flex w-full min-h-[min(480px,calc(100dvh-12rem))] flex-col items-center justify-center px-2',
        className,
      )}
    >
      {body}
    </div>
  )
}