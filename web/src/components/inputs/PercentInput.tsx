import type { InputHTMLAttributes } from 'react'
import { Input } from '../ui/input'

export type PercentInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'inputMode'> & {
  label?: string
}

export function PercentInput({ label, ...props }: PercentInputProps) {
  return (
    <label className="block">
      {label ? <div className="mb-1 text-sm font-medium text-muted-foreground">{label}</div> : null}
      <Input inputMode="decimal" placeholder="0,00" {...props} />
    </label>
  )
}

