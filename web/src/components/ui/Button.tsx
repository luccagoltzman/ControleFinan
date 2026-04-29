import type { ButtonHTMLAttributes } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant
}

const variants: Record<Variant, string> = {
  primary: 'bg-slate-900 text-white hover:bg-slate-800',
  secondary: 'bg-white text-slate-900 border border-slate-300 hover:bg-slate-50',
  ghost: 'bg-transparent text-slate-900 hover:bg-slate-100',
  danger: 'bg-rose-600 text-white hover:bg-rose-500',
}

export function Button({ className = '', variant = 'primary', ...props }: ButtonProps) {
  return (
    <button
      className={[
        'inline-flex items-center justify-center rounded-md px-3 py-2 text-sm font-medium transition',
        'disabled:opacity-60 disabled:cursor-not-allowed',
        variants[variant],
        className,
      ].join(' ')}
      {...props}
    />
  )
}

