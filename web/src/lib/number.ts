export function parseNumberPtBr(raw: string) {
  const normalized = raw.trim().replace(/\s/g, '').replace(/\./g, '').replace(',', '.').replace(/[^0-9.-]/g, '')
  const n = Number(normalized)
  return Number.isFinite(n) ? n : null
}

