import { createContext, useContext, useMemo } from 'react'
import type { PropsWithChildren } from 'react'
import { getRuntimeConfig, type RuntimeConfig } from '@/lib/env'

const EnvContext = createContext<RuntimeConfig | null>(null)

export function EnvProvider({ children }: PropsWithChildren) {
  const config = useMemo(() => getRuntimeConfig(), [])
  return <EnvContext.Provider value={config}>{children}</EnvContext.Provider>
}

export function useRuntimeConfig() {
  const value = useContext(EnvContext)
  if (!value) throw new Error('useRuntimeConfig precisa estar dentro de EnvProvider.')
  return value
}
