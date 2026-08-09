import type { PropsWithChildren } from 'react'
import { AuthProvider } from './AuthProvider'
import { WorkspaceProvider } from './WorkspaceProvider'

export function AppProviders({ children }: PropsWithChildren) {
  return <AuthProvider><WorkspaceProvider>{children}</WorkspaceProvider></AuthProvider>
}
