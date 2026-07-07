import { parseMoneyPtBr } from './money'
import { parseNumberPtBr } from './number'

export type ParsedSaleTax = {
  tax_amount: number | null
  tax_percent_snapshot: number | null
}

export function computeTaxAmountFromPercent(baseAmount: number, percent: number): number {
  const base = Math.max(0, baseAmount)
  return Math.round(((base * percent) / 100) * 100) / 100
}

export function computeTaxPercentFromAmount(baseAmount: number, amount: number): number | null {
  if (baseAmount <= 0) return null
  return Math.round((amount / baseAmount) * 10000) / 100
}

export function formatTaxPercentInput(value: number): string {
  return value.toFixed(2).replace('.', ',')
}

export function parseSaleTaxInput(input: {
  baseAmount: number
  percentRaw: string
  amountRaw: string
}): { ok: true; tax: ParsedSaleTax } | { ok: false; error: string } {
  const pRaw = input.percentRaw.trim()
  const aRaw = input.amountRaw.trim()

  if (!pRaw && !aRaw) {
    return { ok: true, tax: { tax_amount: null, tax_percent_snapshot: null } }
  }

  const amountParsed = aRaw ? parseMoneyPtBr(aRaw) : null
  const percentParsed = pRaw ? parseNumberPtBr(pRaw) : null

  if (aRaw && (amountParsed == null || amountParsed < 0)) {
    return { ok: false, error: 'Valor de imposto inválido.' }
  }
  if (pRaw && (percentParsed == null || percentParsed < 0 || percentParsed > 100)) {
    return { ok: false, error: 'Percentual de imposto inválido (use 0 a 100).' }
  }

  if (amountParsed != null) {
    return {
      ok: true,
      tax: {
        tax_amount: amountParsed,
        tax_percent_snapshot:
          input.baseAmount > 0
            ? computeTaxPercentFromAmount(input.baseAmount, amountParsed)
            : percentParsed,
      },
    }
  }

  if (percentParsed != null) {
    return {
      ok: true,
      tax: {
        tax_percent_snapshot: percentParsed,
        tax_amount: computeTaxAmountFromPercent(input.baseAmount, percentParsed),
      },
    }
  }

  return { ok: true, tax: { tax_amount: null, tax_percent_snapshot: null } }
}

export function taxAmountFromDraft(baseAmount: number, percentRaw: string, amountRaw: string): number {
  const parsed = parseSaleTaxInput({ baseAmount, percentRaw, amountRaw })
  if (!parsed.ok) return 0
  return parsed.tax.tax_amount ?? 0
}
