export function formatPercent01(value01: number) {
  return `${(value01 * 100).toFixed(2)}%`
}

export function parsePercentTo01(raw: string) {
  const normalized = raw.trim().replace('%', '').replace(',', '.').replace(/[^0-9.-]/g, '')
  const n = Number(normalized)
  if (!Number.isFinite(n)) return null
  return n / 100
}

