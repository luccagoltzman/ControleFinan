import { useEffect } from 'react'
import type { OrgSummary } from '../../app/org/OrgContext'
import { getOrgLogoPublicUrl } from '../../lib/orgBranding'

function setMetaThemeColor(color: string) {
  const meta = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null
  if (meta) meta.setAttribute('content', color)
}

function setDocumentTitle(title: string) {
  if (title) document.title = title
}

/**
 * Atualiza título, favicon e cor do tema conforme a organização.
 * O manifest permanece estático em /manifest.webmanifest (data:/blob: geram Syntax error no Chrome).
 */
export function useOrgPwaBranding(activeOrganization: OrgSummary | null) {
  useEffect(() => {
    const faviconLink = document.querySelector('link#pwa-favicon[rel="icon"]') as HTMLLinkElement | null
    const appleTouchIcon = document.querySelector('link#pwa-apple-touch-icon[rel="apple-touch-icon"]') as
      | HTMLLinkElement
      | null

    if (!activeOrganization) {
      if (faviconLink) faviconLink.href = '/favicon.svg'
      if (appleTouchIcon) appleTouchIcon.href = '/favicon.svg'
      setDocumentTitle('Controle Finan')
      setMetaThemeColor('#0f172a')
      return
    }

    const name = activeOrganization.name?.trim() || 'Controle Finan'
    const logoUrlBase = getOrgLogoPublicUrl(activeOrganization.logo_storage_path)
    const logoUrl = logoUrlBase
      ? `${logoUrlBase}?v=${encodeURIComponent(activeOrganization.branding_updated_at)}`
      : null

    if (faviconLink && logoUrl) faviconLink.href = logoUrl
    if (appleTouchIcon && logoUrl) appleTouchIcon.href = logoUrl
    setDocumentTitle(name)
  }, [activeOrganization])
}
