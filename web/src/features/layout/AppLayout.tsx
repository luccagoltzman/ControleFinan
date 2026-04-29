import { NavLink, Outlet } from 'react-router-dom'
import { BarChart3, Building2, Package, Receipt, Wallet } from 'lucide-react'
import { Button } from '../../components/ui/button'
import { cn } from '../../lib/cn'
import { useAuth } from '../../app/auth/useAuth'
import { supabase } from '../../app/supabaseClient'

function NavItem({
  to,
  label,
  icon: Icon,
}: {
  to: string
  label: string
  icon: React.ComponentType<{ className?: string }>
}) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium',
          isActive
            ? 'bg-primary text-primary-foreground'
            : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
        )
      }
    >
      <Icon className="h-4 w-4" />
      {label}
    </NavLink>
  )
}

export function AppLayout() {
  const { user } = useAuth()

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
            <Button variant="outline" onClick={() => supabase.auth.signOut()}>
              Sair
            </Button>
          </div>
        </div>
      </header>

      <div className="container-app grid grid-cols-1 gap-6 py-6 md:grid-cols-[220px_1fr]">
        <aside className="rounded-lg border border-border bg-card p-2">
          <nav className="space-y-1">
            <NavItem to="/app/products" label="Produtos" icon={Package} />
            <NavItem to="/app/sales" label="Vendas" icon={Receipt} />
            <NavItem to="/app/payroll" label="Folha salarial" icon={Wallet} />
            <NavItem to="/app/org" label="Organização" icon={Building2} />
          </nav>
        </aside>

        <main className="rounded-lg border border-border bg-card p-5">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

