import { useEffect, type ChangeEvent } from 'react'
import { Input } from '../../components/ui/input'
import { Label } from '../../components/ui/label'
import { MoneyInput } from '../../components/inputs/MoneyInput'
import { formatMoney, parseMoneyPtBr } from '../../lib/money'
import { parseNumberPtBr } from '../../lib/number'
import {
  computeTaxAmountFromPercent,
  computeTaxPercentFromAmount,
  formatTaxPercentInput,
  taxAmountFromDraft,
} from '../../lib/saleTax'

type Props = {
  baseAmount: number
  baseLabel?: string
  percent: string
  amount: string
  onPercentChange: (value: string) => void
  onAmountChange: (value: string) => void
}

function formatAmountInput(value: number): string {
  return String(value).replace('.', ',')
}

export function SaleTaxFields({
  baseAmount,
  baseLabel = 'Lucro + comissão',
  percent,
  amount,
  onPercentChange,
  onAmountChange,
}: Props) {
  useEffect(() => {
    if (!percent.trim() || baseAmount <= 0) return
    const p = parseNumberPtBr(percent)
    if (p == null) return
    onAmountChange(formatAmountInput(computeTaxAmountFromPercent(baseAmount, p)))
  }, [baseAmount])

  function handlePercentChange(raw: string) {
    onPercentChange(raw)
    if (!raw.trim()) {
      onAmountChange('')
      return
    }
    const p = parseNumberPtBr(raw)
    if (p != null && baseAmount > 0) {
      onAmountChange(formatAmountInput(computeTaxAmountFromPercent(baseAmount, p)))
    }
  }

  function handleAmountChange(raw: string) {
    onAmountChange(raw)
    if (!raw.trim()) {
      onPercentChange('')
      return
    }
    const a = parseMoneyPtBr(raw)
    if (a != null && baseAmount > 0) {
      const pct = computeTaxPercentFromAmount(baseAmount, a)
      onPercentChange(pct != null ? formatTaxPercentInput(pct) : '')
    }
  }

  const taxValue = taxAmountFromDraft(baseAmount, percent, amount)
  const net = baseAmount - taxValue

  return (
    <div className="space-y-3">
      <div className="text-xs text-muted-foreground">
        Base ({baseLabel}): <span className="font-medium text-foreground">{formatMoney(baseAmount)}</span>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <Label>Imposto (%)</Label>
          <Input
            className="mt-1"
            inputMode="decimal"
            placeholder="Ex.: 15,5"
            value={percent}
            onChange={(e: ChangeEvent<HTMLInputElement>) => handlePercentChange(e.target.value)}
          />
          <p className="mt-1 text-xs text-muted-foreground">Calcula o valor automaticamente</p>
        </div>
        <div>
          <MoneyInput
            label="Imposto (valor)"
            value={amount}
            onChange={(e: ChangeEvent<HTMLInputElement>) => handleAmountChange(e.target.value)}
          />
          <p className="mt-1 text-xs text-muted-foreground">Ou digite o valor direto</p>
        </div>
      </div>
      {taxValue > 0 ? (
        <div className="text-xs text-muted-foreground">
          Líquido estimado após imposto:{' '}
          <span className="font-semibold text-emerald-800">{formatMoney(net)}</span>
        </div>
      ) : null}
    </div>
  )
}

export function loadSaleTaxDrafts(tax: { tax_amount: number | null; tax_percent_snapshot: number | null }): {
  percent: string
  amount: string
} {
  const amount =
    tax.tax_amount != null && tax.tax_amount > 0 ? String(tax.tax_amount).replace('.', ',') : ''
  const percent =
    tax.tax_percent_snapshot != null && tax.tax_percent_snapshot > 0
      ? formatTaxPercentInput(tax.tax_percent_snapshot)
      : ''
  return { percent, amount }
}
