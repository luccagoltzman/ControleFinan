import { NavLink, Outlet } from 'react-router-dom'
import { BarChart3, Building2, LayoutDashboard, MapPinned, Package, Receipt, Wallet } from 'lucide-react'
import { Button } from '../../components/ui/button'
import { cn } from '../../lib/cn'
import { useAuth } from '../../app/auth/useAuth'
import { supabase } from '../../app/supabaseClient'
import { useEffect, useState } from 'react'

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

export function AppLayout() {
  const { user } = useAuth()
  // compact: sidebar fica estreita e expande no hover
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
    <div className="min-h-screen bg-muted/30">
      <header className="border-b border-border bg-background/70 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-10">
        <div className="container-app flex h-14 items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <BarChart3 className="h-5 w-5" />
            </div>
            <div>
              <div className="font-semibold leading-tight">ControleFinan</div>
              <div className="text-xs text-muted-foreground">Preços • Vendas • Folha</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden sm:block text-xs text-muted-foreground">{user?.email}</div>
            <Button
              variant="outline"
              onClick={() => setCompact((v) => !v)}
              title={compact ? 'Fixar menu expandido' : 'Ativar menu compacto (expande no hover)'}
            >
              {compact ? 'Fixar expandido' : 'Compacto'}
            </Button>
            <Button variant="outline" onClick={() => supabase.auth.signOut()}>
              Sair
            </Button>
          </div>
        </div>
      </header>

      <div className="container-app py-6">
        <div className="flex flex-col gap-6 md:flex-row">
          <aside
            className={cn(
              'shrink-0 md:sticky md:top-[88px] h-fit rounded-xl border border-border bg-card/70 backdrop-blur supports-[backdrop-filter]:bg-card/60 p-2',
              'transition-[width,padding] duration-200 ease-out',
              isCollapsed ? 'md:w-[72px] px-1' : 'md:w-[220px] px-2',
            )}
            onMouseEnter={() => setIsHoveringSidebar(true)}
            onMouseLeave={() => setIsHoveringSidebar(false)}
          >
            <nav className="space-y-1">
              <NavItem to="/app/dashboard" label="Dashboard" icon={LayoutDashboard} collapsed={isCollapsed} />
              <NavItem to="/app/products" label="Produtos" icon={Package} collapsed={isCollapsed} />
              <NavItem to="/app/sales" label="Vendas" icon={Receipt} collapsed={isCollapsed} />
              <NavItem to="/app/regions" label="Regiões" icon={MapPinned} collapsed={isCollapsed} />
              <NavItem to="/app/payroll" label="Folha salarial" icon={Wallet} collapsed={isCollapsed} />
              <NavItem to="/app/org" label="Organização" icon={Building2} collapsed={isCollapsed} />
            </nav>
          </aside>

          <main className="min-w-0 flex-1 rounded-xl border border-border bg-card/70 backdrop-blur supports-[backdrop-filter]:bg-card/60 p-6 md:p-8 overflow-hidden">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  )
}

