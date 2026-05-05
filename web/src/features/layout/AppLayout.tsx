import { NavLink, Outlet } from 'react-router-dom'
import {
  Banknote,
  BarChart3,
  Building2,
  LayoutDashboard,
  MapPinned,
  Package,
  Receipt,
  ScrollText,
  Wallet,
} from 'lucide-react'
import { Button } from '../../components/ui/button.tsx'
import { cn } from '../../lib/cn'
import { isPrivilegedOrgRole } from '../../lib/orgPrivileges'
import { useAuth } from '../../app/auth/useAuth'
import { supabase } from '../../app/supabaseClient'
import { useOrg } from '../../app/org/useOrg'
import { useEffect, useMemo, useState } from 'react'
import { getOrgLogoPublicUrl, orgPrimaryCssVars } from '../../lib/orgBranding'

const APP_NAV_ENTRIES = [
  { to: '/app/dashboard', label: 'Dashboard', shortLabel: 'Painel', icon: LayoutDashboard, ownerAdminOnly: false },
  { to: '/app/products', label: 'Produtos', shortLabel: 'Produtos', icon: Package, ownerAdminOnly: false },
  { to: '/app/sales', label: 'Vendas', shortLabel: 'Vendas', icon: Receipt, ownerAdminOnly: false },
  { to: '/app/regions', label: 'Regiões', shortLabel: 'Regiões', icon: MapPinned, ownerAdminOnly: false },
  { to: '/app/payroll', label: 'Folha salarial', shortLabel: 'Folha', icon: Wallet, ownerAdminOnly: true },
  { to: '/app/expenses', label: 'Despesas avulsas', shortLabel: 'Despesas', icon: Banknote, ownerAdminOnly: true },
  {
    to: '/app/audit',
    label: 'Registro de atividades',
    shortLabel: 'Atividades',
    icon: ScrollText,
    ownerAdminOnly: true,
  },
  { to: '/app/org', label: 'Organização', shortLabel: 'Conta', icon: Building2, ownerAdminOnly: false },
] as const

function NavItem({
  to,
  label,
  icon: Icon,
  collapsed,
}: {
  to: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  collapsed: boolean
}) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          'flex items-center rounded-md px-3 py-2 text-sm font-medium transition-colors',
          collapsed ? 'justify-center' : 'gap-2',
          isActive
            ? 'bg-primary text-primary-foreground'
            : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
        )
      }
      title={label}
    >
      <Icon className="h-4 w-4" />
      <span
        className={cn(
          'truncate transition-[max-width,opacity] duration-200 ease-out',
          collapsed ? 'max-w-0 opacity-0' : 'max-w-[160px] opacity-100',
        )}
      >
        {label}
      </span>
    </NavLink>
  )
}

function MobileBottomNav({
  items,
}: {
  items: ReadonlyArray<(typeof APP_NAV_ENTRIES)[number]>
}) {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background/95 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1 shadow-[0_-4px_24px_rgba(0,0,0,0.06)] backdrop-blur-md supports-[backdrop-filter]:bg-background/80 md:hidden"
      aria-label="Menu principal"
    >
      <ul className="container-app flex items-stretch justify-between gap-0.5 px-1">
        {items.map(({ to, shortLabel, icon: Icon }) => (
          <li key={to} className="min-w-0 flex-1">
            <NavLink
              to={to}
              className={({ isActive }) =>
                cn(
                  'flex flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-2 text-[10px] font-medium leading-tight transition-colors sm:text-xs',
                  isActive
                    ? 'text-primary'
                    : 'text-muted-foreground active:bg-muted/80 hover:text-foreground',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className={cn(
                      'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors',
                      isActive ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-muted/60',
                    )}
                  >
                    <Icon className="h-5 w-5" aria-hidden />
                  </span>
                  <span className="line-clamp-2 w-full text-center">{shortLabel}</span>
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}

export function AppLayout() {
  const { user } = useAuth()
  const { activeOrganization, activeOrgId, memberships, error: orgError, isLoading: orgLoading } = useOrg()

  const activeRole = useMemo(
    () => memberships.find((m) => m.organization_id === activeOrgId)?.role,
    [memberships, activeOrgId],
  )
  const showOwnerAdminNav = isPrivilegedOrgRole(activeRole)

  const navItems = useMemo(
    () => APP_NAV_ENTRIES.filter((e) => !e.ownerAdminOnly || showOwnerAdminNav),
    [showOwnerAdminNav],
  )

  const brandStyle = useMemo(
    () => orgPrimaryCssVars(activeOrganization?.brand_color ?? null),
    [activeOrganization?.brand_color],
  )

  const headerLogoUrl = useMemo(() => {
    if (!activeOrganization?.logo_storage_path) return null
    const base = getOrgLogoPublicUrl(activeOrganization.logo_storage_path)
    if (!base) return null
    return `${base}?v=${encodeURIComponent(activeOrganization.branding_updated_at)}`
  }, [
    activeOrganization?.logo_storage_path,
    activeOrganization?.branding_updated_at,
  ])

  const headerTitle = activeOrganization?.name ?? 'ControleFinan'
  const [compact, setCompact] = useState<boolean>(() => {
    const raw = window.localStorage.getItem('cf.sidebar.compact')
    return raw ? raw === '1' : true
  })
  const [isHoveringSidebar, setIsHoveringSidebar] = useState(false)

  useEffect(() => {
    window.localStorage.setItem('cf.sidebar.compact', compact ? '1' : '0')
  }, [compact])

  const isCollapsed = compact && !isHoveringSidebar

  return (
    <div className="min-h-screen bg-muted/30 pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:pb-0" style={brandStyle}>
      <header className="border-b border-border bg-background/70 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-10">
        <div className="container-app flex h-14 items-center justify-between gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
            <div
              className={
                headerLogoUrl
                  ? 'flex h-10 max-h-10 min-h-10 min-w-10 max-w-[200px] shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-background px-1.5 py-1 shadow-sm sm:h-11 sm:max-h-11 sm:min-h-11 sm:min-w-11 sm:max-w-[240px] sm:px-2 sm:py-1.5'
                  : 'flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-primary text-primary-foreground ring-1 ring-border/60 sm:h-11 sm:w-11'
              }
            >
              {headerLogoUrl ? (
                <img src={headerLogoUrl} alt="" className="max-h-full max-w-full object-contain object-center" />
              ) : (
                <BarChart3 className="h-5 w-5 shrink-0 sm:h-6 sm:w-6" />
              )}
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold leading-tight sm:text-base">{headerTitle}</div>
              <div className="hidden text-xs text-muted-foreground sm:block">Preços • Vendas • Folha</div>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-3">
            <div className="hidden text-xs text-muted-foreground sm:block">{user?.email}</div>
            <Button
              variant="outline"
              size="sm"
              className="hidden md:inline-flex"
              onClick={() => setCompact((v) => !v)}
              title={compact ? 'Fixar menu expandido' : 'Ativar menu compacto (expande no hover)'}
            >
              {compact ? 'Fixar expandido' : 'Compacto'}
            </Button>
            <Button variant="outline" size="sm" className="shrink-0 px-2 sm:px-4" onClick={() => supabase.auth.signOut()}>
              Sair
            </Button>
          </div>
        </div>
      </header>

      <div className="container-app py-4 md:py-6">
        {orgLoading ? (
          <div className="mb-4 rounded-lg border border-border bg-background/60 px-4 py-3 text-sm text-muted-foreground">
            Carregando organização…
          </div>
        ) : orgError ? (
          <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            Não foi possível carregar as informações da organização. Detalhes: {orgError}
          </div>
        ) : null}
        <div className="flex flex-col gap-4 md:flex-row md:gap-6">
          <aside
            className={cn(
              'hidden shrink-0 md:block md:sticky md:top-[88px] md:h-fit rounded-xl border border-border bg-card/70 p-2 backdrop-blur supports-[backdrop-filter]:bg-card/60',
              'transition-[width,padding] duration-200 ease-out',
              isCollapsed ? 'md:w-[72px] md:px-1' : 'md:w-[220px] md:px-2',
            )}
            onMouseEnter={() => setIsHoveringSidebar(true)}
            onMouseLeave={() => setIsHoveringSidebar(false)}
          >
            <nav className="space-y-1">
              {navItems.map(({ to, label, icon }) => (
                <NavItem key={to} to={to} label={label} icon={icon} collapsed={isCollapsed} />
              ))}
            </nav>
          </aside>

          <main className="min-w-0 flex-1 overflow-hidden rounded-xl border border-border bg-card/70 p-4 backdrop-blur supports-[backdrop-filter]:bg-card/60 sm:p-6 md:p-8">
            <Outlet />
          </main>
        </div>
      </div>

      <MobileBottomNav items={navItems} />
    </div>
  )
}
