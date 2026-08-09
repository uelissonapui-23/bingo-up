import { BrowserRouter } from 'react-router-dom'
import { AppProviders } from '@/app/providers/AppProviders'
import { AppRouter } from '@/app/router/AppRouter'
import { AppErrorBoundary } from '@/components/layout/AppErrorBoundary'

export function App() {
  return (
    <AppErrorBoundary>
      <BrowserRouter>
        <AppProviders>
          <AppRouter />
        </AppProviders>
      </BrowserRouter>
    </AppErrorBoundary>
  )
}
