import { RouterProvider } from 'react-router-dom'
import { AppProviders } from './app/AppProviders'
import { router } from './app/router'
import { ToastHost } from './components/toast/ToastHost'

export function App() {
  return (
    <AppProviders>
      <RouterProvider router={router} />
      <ToastHost />
    </AppProviders>
  )
}
