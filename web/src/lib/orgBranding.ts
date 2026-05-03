import type { CSSProperties } from 'react'
import { supabase } from '../app/supabaseClient'

const ORG_LOGO_BUCKET = 'org-assets'

export function hexToHslComponents(hex: string): { h: number; s: number; l: number } | null {
  const h = hex.trim()
  if (!/^#[0-9A-Fa-f]{6}$/i.test(h)) return null
  const r = parseInt(h.slice(1, 3), 16) / 255
  const g = parseInt(h.slice(3, 5), 16) / 255
  const b = parseInt(h.slice(5, 7), 16) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  let hue = 0
  let s = 0
  const l = (max + min) / 2
  const d = max - min
  if (d !== 0) {
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r:
        hue = ((g - b) / d + (g < b ? 6 : 0)) / 6
        break
      case g:
        hue = ((b - r) / d + 2) / 6
        break
      case b:
        hue = ((r - g) / d + 4) / 6
        break
      default:
        break
    }
  }
  return { h: hue * 360, s: s * 100, l: l * 100 }
}

/** Variáveis CSS no formato do tema (H sem unidade, S e L em %). */
export function orgPrimaryCssVars(brandColor: string | null): CSSProperties | undefined {
  if (!brandColor) return undefined
  const c = hexToHslComponents(brandColor)
  if (!c) return undefined
  const primary = `${c.h.toFixed(1)} ${c.s.toFixed(1)}% ${c.l.toFixed(1)}%`
  const fg = c.l > 55 ? '222.2 47.4% 11.2%' : '210 40% 98%'
  return {
    '--primary': primary,
    '--primary-foreground': fg,
    '--ring': primary,
  } as CSSProperties
}

export function getOrgLogoPublicUrl(logoStoragePath: string | null): string | null {
  if (!logoStoragePath?.trim()) return null
  const { data } = supabase.storage.from(ORG_LOGO_BUCKET).getPublicUrl(logoStoragePath.trim())
  return data.publicUrl
}

export const orgLogoBucket = ORG_LOGO_BUCKET
