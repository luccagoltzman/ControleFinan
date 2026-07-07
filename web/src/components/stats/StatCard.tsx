import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

type Accent = 'default' | 'positive' | 'muted'

export function StatCard({
  label,
  value,
  hint,
  accent = 'default',
}: {
  label: string
  value: string
  hint?: string
  accent?: Accent
}) {
  return (
    <div className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p
        className={cn(
          'mt-2 break-words text-base font-semibold tabular-nums leading-tight sm:text-lg',
          accent === 'positive' && 'text-emerald-700 dark:text-emerald-400',
          accent === 'muted' && 'text-muted-foreground',
        )}
        title={value}
      >
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  )
}

export function StatSection({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
      </div>
      {children}
    </section>
  )
}
