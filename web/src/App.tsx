import { RouterProvider } from 'react-router-dom'
import { AppProviders } from './app/AppProviders'
import { router } from './app/router'
import { PwaUpdateBanner } from './components/pwa/PwaUpdateBanner'
import { useOrg } from './app/org/useOrg'
import { useOrgPwaBranding } from './components/pwa/useOrgPwaBranding'
import { ToastHost } from './components/toast/ToastHost'

export function App() {
  return (
    <AppProviders>
      <AppInner />
    </AppProviders>
  )
}

function AppInner() {
  const { activeOrganization } = useOrg()
  useOrgPwaBranding(activeOrganization)

  return (
    <>
      <RouterProvider router={router} />
      <ToastHost />
      <PwaUpdateBanner />
    </>
  )
}
