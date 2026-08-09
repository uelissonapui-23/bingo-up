import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react'
import { useAuth } from '@/app/providers/AuthProvider'
import type { WorkspaceWithMembership } from '@/types/database'
import { getLastWorkspaceId, listMyWorkspaces, persistLastWorkspace } from '@/features/workspace/workspaceService'

type WorkspaceState = {
  workspaces: WorkspaceWithMembership[]
  currentWorkspace: WorkspaceWithMembership | null
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
  selectWorkspace: (workspaceId: string) => Promise<void>
}

const WorkspaceContext = createContext<WorkspaceState | null>(null)

export function WorkspaceProvider({ children }: PropsWithChildren) {
  const { user, loading: authLoading } = useAuth()
  const [workspaces, setWorkspaces] = useState<WorkspaceWithMembership[]>([])
  const [currentWorkspace, setCurrentWorkspace] = useState<WorkspaceWithMembership | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!user) { setWorkspaces([]); setCurrentWorkspace(null); setLoading(false); return }
    setLoading(true); setError(null)
    try {
      const [items, lastId] = await Promise.all([listMyWorkspaces(), getLastWorkspaceId()])
      setWorkspaces(items)
      const selected = items.find(w => w.id === lastId) ?? items[0] ?? null
      setCurrentWorkspace(selected)
      if (selected && selected.id !== lastId) await persistLastWorkspace(selected.id)
    } catch {
      setError('Não foi possível carregar o espaço do organizador.')
    } finally { setLoading(false) }
  }, [user])

  useEffect(() => { if (!authLoading) void refresh() }, [authLoading, refresh])

  const selectWorkspace = useCallback(async (workspaceId: string) => {
    const selected = workspaces.find(w => w.id === workspaceId)
    if (!selected) return
    setCurrentWorkspace(selected)
    await persistLastWorkspace(workspaceId)
  }, [workspaces])

  const value = useMemo(() => ({ workspaces, currentWorkspace, loading, error, refresh, selectWorkspace }), [workspaces, currentWorkspace, loading, error, refresh, selectWorkspace])
  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext)
  if (!ctx) throw new Error('useWorkspace must be used inside WorkspaceProvider')
  return ctx
}
