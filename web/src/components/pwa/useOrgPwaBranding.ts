import { useEffect, useRef } from 'react'
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
 * Atualiza dinamicamente o manifest (nome/ícone) conforme a organização ativa.
 * Isso influencia o fluxo de “Instalar app” no Chrome/Edge (PWA).
 */
export function useOrgPwaBranding(activeOrganization: OrgSummary | null) {
  const blobUrlRef = useRef<string | null>(null)

  useEffect(() => {
    const manifestLink = document.querySelector('link#pwa-manifest[rel="manifest"]') as HTMLLinkElement | null
    const faviconLink = document.querySelector('link#pwa-favicon[rel="icon"]') as HTMLLinkElement | null
    const appleTouchIcon = document.querySelector('link#pwa-apple-touch-icon[rel="apple-touch-icon"]') as
      | HTMLLinkElement
      | null

    if (!manifestLink) return

    // cleanup blob anterior
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current)
      blobUrlRef.current = null
    }

    if (!activeOrganization) {
      manifestLink.href = '/manifest.webmanifest'
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

    const manifest = {
      name,
      short_name: name,
      description: 'Controlo financeiro da sua organização.',
      theme_color: '#0f172a',
      background_color: '#ffffff',
      display: 'standalone',
      orientation: 'portrait-primary',
      scope: '/',
      start_url: '/',
      lang: 'pt-BR',
      categories: ['finance', 'productivity'],
      icons: [
        ...(logoUrl
          ? [
              {
                src: logoUrl,
                sizes: 'any',
                purpose: 'any',
              },
              {
                src: logoUrl,
                sizes: 'any',
                purpose: 'maskable',
              },
            ]
          : []),
        {
          src: '/favicon.svg',
          sizes: 'any',
          type: 'image/svg+xml',
          purpose: 'any',
        },
      ],
    }

    const blob = new Blob([JSON.stringify(manifest)], { type: 'application/manifest+json' })
    const blobUrl = URL.createObjectURL(blob)
    blobUrlRef.current = blobUrl
    manifestLink.href = blobUrl

    if (faviconLink && logoUrl) faviconLink.href = logoUrl
    if (appleTouchIcon && logoUrl) appleTouchIcon.href = logoUrl
    setDocumentTitle(name)
  }, [activeOrganization])
}

