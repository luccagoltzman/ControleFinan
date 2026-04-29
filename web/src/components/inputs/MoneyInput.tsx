import type { InputHTMLAttributes } from 'react'
import { Input } from '../ui/input'

export type MoneyInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'inputMode'> & {
  label?: string
}

export function MoneyInput({ label, ...props }: MoneyInputProps) {
  return (
    <label className="block">
      {label ? <div className="mb-1 text-sm font-medium text-muted-foreground">{label}</div> : null}
      <Input inputMode="decimal" placeholder="0,00" {...props} />
    </label>
  )
}

