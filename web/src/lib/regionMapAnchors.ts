/** Remove acentos e padroniza para comparação */
export function normalizeRegionKey(name: string): string {
  return name
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
}

/**
 * Coordenadas aproximadas (capital ou centro do estado) para nome de UF / região comum.
 * Usado no mapa quando a região não tem map_lat/map_lng cadastrados.
 */
const STATE_ANCHORS: Record<string, [number, number]> = {
  acre: [-9.9759, -67.8243],
  alagoas: [-9.6658, -35.7353],
  amapa: [0.0349, -51.0694],
  amazonas: [-3.119, -60.0217],
  bahia: [-12.9714, -38.5014],
  ceara: [-3.7172, -38.5434],
  'distrito federal': [-15.7942, -47.8822],
  brasilia: [-15.7942, -47.8822],
  'espirito santo': [-20.3155, -40.3128],
  goias: [-16.6869, -49.2648],
  maranhao: [-2.5387, -44.2825],
  'mato grosso': [-15.601, -56.0979],
  'mato grosso do sul': [-20.4697, -54.6201],
  'minas gerais': [-19.9167, -43.9345],
  para: [-1.4558, -48.5044],
  paraiba: [-7.1195, -34.845],
  parana: [-25.4284, -49.2733],
  pernambuco: [-8.0476, -34.877],
  piaui: [-5.0949, -42.8034],
  'rio de janeiro': [-22.9068, -43.1729],
  'rio grande do norte': [-5.7945, -35.211],
  'rio grande do sul': [-30.0346, -51.2177],
  rondonia: [-8.7619, -63.9039],
  roraima: [2.8235, -60.6758],
  'santa catarina': [-27.5954, -48.548],
  'sao paulo': [-23.5505, -46.6333],
  sergipe: [-10.9472, -37.0731],
  tocantins: [-10.2491, -48.3243],
}

const ANCHOR_ENTRIES = Object.entries(STATE_ANCHORS)

export function suggestedAnchorForRegionName(name: string): [number, number] | null {
  const n = normalizeRegionKey(name)
  if (!n) return null
  if (STATE_ANCHORS[n]) return STATE_ANCHORS[n]

  for (const [key, coord] of ANCHOR_ENTRIES) {
    if (n.includes(key) || key.includes(n)) {
      if (key.length >= 4 || n === key) return coord
    }
  }
  return null
}

/** Centro do Brasil para zoom inicial quando há poucos pontos */
export const BRAZIL_MAP_CENTER: [number, number] = [-14.235, -51.9253]
