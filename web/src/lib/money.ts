const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

export function formatMoney(value: number) {
  return currency.format(value)
}

export function parseMoneyPtBr(raw: string) {
  const normalized = raw
    .trim()
    .replace(/\s/g, '')
    .replace(/[R$\u00A0]/g, '')
    .replace(/\./g, '')
    .replace(',', '.')
    .replace(/[^0-9.-]/g, '')

  const n = Number(normalized)
  return Number.isFinite(n) ? n : null
}

//teste de commit;

