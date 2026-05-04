import { RouterProvider } from 'react-router-dom'
import { AppProviders } from './app/AppProviders'
import { router } from './app/router'
import { PwaUpdateBanner } from './components/pwa/PwaUpdateBanner'
import { ToastHost } from './components/toast/ToastHost'

export function App() {
  return (
    <AppProviders>
      <RouterProvider router={router} />
      <ToastHost />
      <PwaUpdateBanner />
    </AppProviders>
  )
}
