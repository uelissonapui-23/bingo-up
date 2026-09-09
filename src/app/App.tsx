import { BrowserRouter } from 'react-router-dom'
import { AppProviders } from '@/app/providers/AppProviders'
import { AppRouter } from '@/app/router/AppRouter'
import { AppErrorBoundary } from '@/components/layout/AppErrorBoundary'
import { OfflineBanner } from '@/components/ui/OfflineBanner'
import { PwaStatus } from '@/components/ui/PwaStatus'

export function App() {
  return (
    <AppErrorBoundary>
      <OfflineBanner />
      <PwaStatus />
      <BrowserRouter>
        <AppProviders>
          <AppRouter />
        </AppProviders>
      </BrowserRouter>
    </AppErrorBoundary>
  )
}
