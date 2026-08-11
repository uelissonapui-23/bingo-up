import type { PropsWithChildren } from 'react'
import { AuthProvider } from './AuthProvider'
import { WorkspaceProvider } from './WorkspaceProvider'
import { PlatformBrandProvider } from '@/components/brand/PlatformBrandProvider'

export function AppProviders({ children }: PropsWithChildren) {
  return <PlatformBrandProvider><AuthProvider><WorkspaceProvider>{children}</WorkspaceProvider></AuthProvider></PlatformBrandProvider>
}
