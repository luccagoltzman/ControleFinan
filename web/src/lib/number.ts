export function parseNumberPtBr(raw: string) {
  const normalized = raw.trim().replace(/\s/g, '').replace(/\./g, '').replace(',', '.').replace(/[^0-9.-]/g, '')
  const n = Number(normalized)
  return Number.isFinite(n) ? n : null
}

/** Latitude/longitude: aceita vírgula ou ponto decimal (ex.: -14,23 ou -48.5039). */
export function parseCoordNumber(raw: string): number | null {
  const s = raw.trim().replace(/\s/g, '')
  if (!s) return null
  const n = Number(s.replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

