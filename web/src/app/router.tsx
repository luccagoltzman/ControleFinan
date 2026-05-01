import { createBrowserRouter, Navigate } from 'react-router-dom'
import { RequireAuth } from './routes/RequireAuth'
import { RequireOrganization } from './routes/RequireOrganization'
import { AppLayout } from '../features/layout/AppLayout'
import { LoginPage } from '../features/auth/LoginPage'
import { ProductsPage } from '../features/products/ProductsPage'
import { SalesPage } from '../features/sales/SalesPage'
import { PayrollPage } from '../features/payroll/PayrollPage'
import { OrgPage } from '../features/org/OrgPage'
import { DashboardPage } from '../features/dashboard/DashboardPage'
import { RegionsPage } from '../features/regions/RegionsPage'

export const router = createBrowserRouter([
  { path: '/', element: <Navigate to="/app/products" replace /> },
  { path: '/login', element: <LoginPage /> },
  {
    path: '/app',
    element: (
      <RequireAuth>
        <AppLayout />
      </RequireAuth>
    ),
    children: [
      { index: true, element: <Navigate to="products" replace /> },
      {
        path: 'dashboard',
        element: (
          <RequireOrganization>
            <DashboardPage />
          </RequireOrganization>
        ),
      },
      {
        path: 'regions',
        element: (
          <RequireOrganization>
            <RegionsPage />
          </RequireOrganization>
        ),
      },
      {
        path: 'products',
        element: (
          <RequireOrganization>
            <ProductsPage />
          </RequireOrganization>
        ),
      },
      {
        path: 'sales',
        element: (
          <RequireOrganization>
            <SalesPage />
          </RequireOrganization>
        ),
      },
      {
        path: 'payroll',
        element: (
          <RequireOrganization>
            <PayrollPage />
          </RequireOrganization>
        ),
      },
      { path: 'org', element: <OrgPage /> },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
])

