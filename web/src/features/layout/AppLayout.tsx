import { NavLink, Outlet } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { useAuth } from '../../app/auth/useAuth'
import { supabase } from '../../app/supabaseClient'

function NavItem({ to, label }: { to: string; label: string }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        [
          'block rounded-md px-3 py-2 text-sm font-medium',
          isActive ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100',
        ].join(' ')
      }
    >
      {label}
    </NavLink>
  )
}

export function AppLayout() {
  const { user } = useAuth()

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="container-app flex h-14 items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="font-semibold text-slate-900">ControleFinan</div>
            <div className="text-xs text-slate-500">Preços • Folha</div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden sm:block text-xs text-slate-600">{user?.email}</div>
            <Button variant="secondary" onClick={() => supabase.auth.signOut()}>
              Sair
            </Button>
          </div>
        </div>
      </header>

      <div className="container-app grid grid-cols-1 gap-6 py-6 md:grid-cols-[220px_1fr]">
        <aside className="rounded-lg border border-slate-200 bg-white p-2">
          <nav className="space-y-1">
            <NavItem to="/app/products" label="Produtos" />
            <NavItem to="/app/payroll" label="Folha salarial" />
            <NavItem to="/app/org" label="Organização" />
          </nav>
        </aside>

        <main className="rounded-lg border border-slate-200 bg-white p-5">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

