import type { InputHTMLAttributes } from 'react'

export type InputProps = InputHTMLAttributes<HTMLInputElement>

export function Input({ className = '', ...props }: InputProps) {
  return (
    <input
      className={[
        'w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm',
        'placeholder:text-slate-400',
        'focus:outline-none focus:ring-2 focus:ring-slate-900/20 focus:border-slate-400',
        className,
      ].join(' ')}
      {...props}
    />
  )
}

