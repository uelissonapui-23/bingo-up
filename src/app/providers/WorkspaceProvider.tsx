import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type PropsWithChildren } from 'react'
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

const wait = (ms:number) => new Promise(resolve => window.setTimeout(resolve, ms))

async function loadWorkspacesWithRetry(attempts=3){
  let lastError:unknown
  for(let attempt=0;attempt<attempts;attempt++){
    try{return await listMyWorkspaces()}catch(error){
      lastError=error
      if(attempt<attempts-1)await wait(350*(attempt+1))
    }
  }
  throw lastError
}

export function WorkspaceProvider({ children }: PropsWithChildren) {
  const { user, loading: authLoading } = useAuth()
  const [workspaces, setWorkspaces] = useState<WorkspaceWithMembership[]>([])
  const [currentWorkspace, setCurrentWorkspace] = useState<WorkspaceWithMembership | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const currentRef=useRef<WorkspaceWithMembership|null>(null)
  const loadedOnceRef=useRef(false)
  useEffect(()=>{currentRef.current=currentWorkspace},[currentWorkspace])

  const refresh = useCallback(async () => {
    if (!user) {
      setWorkspaces([]); setCurrentWorkspace(null); currentRef.current=null; setError(null); setLoading(false); loadedOnceRef.current=false
      return
    }
    // Em atualizações silenciosas, preserve a tela atual. Uma oscilação de rede não deve desmontar o app.
    if(!loadedOnceRef.current)setLoading(true)
    try {
      const items=await loadWorkspacesWithRetry(3)
      let lastId:string|null|undefined
      try{lastId=await getLastWorkspaceId()}catch{lastId=currentRef.current?.id}
      setWorkspaces(items)
      const selected = items.find(w => w.id === (currentRef.current?.id??lastId)) ?? items.find(w=>w.id===lastId) ?? items[0] ?? null
      setCurrentWorkspace(selected);currentRef.current=selected
      setError(null);loadedOnceRef.current=true
      if (selected && selected.id !== lastId) {
        try{await persistLastWorkspace(selected.id)}catch{/* preferência não pode derrubar o espaço já carregado */}
      }
    } catch {
      // Se já existe um espaço válido em memória, continue operando e tente novamente depois.
      if(!currentRef.current)setError('Não foi possível carregar o espaço do organizador. Tentando reconectar…')
    } finally { setLoading(false) }
  }, [user])

  useEffect(() => { if (!authLoading) void refresh() }, [authLoading, refresh])
  useEffect(()=>{
    if(authLoading||!user)return
    const retry=()=>void refresh()
    const id=window.setInterval(retry,15000)
    window.addEventListener('online',retry)
    window.addEventListener('focus',retry)
    return()=>{window.clearInterval(id);window.removeEventListener('online',retry);window.removeEventListener('focus',retry)}
  },[authLoading,user,refresh])

  const selectWorkspace = useCallback(async (workspaceId: string) => {
    const selected = workspaces.find(w => w.id === workspaceId)
    if (!selected) return
    setCurrentWorkspace(selected);currentRef.current=selected;setError(null)
    try{await persistLastWorkspace(workspaceId)}catch{/* mantém seleção local mesmo se a preferência falhar */}
  }, [workspaces])

  const value = useMemo(() => ({ workspaces, currentWorkspace, loading, error, refresh, selectWorkspace }), [workspaces, currentWorkspace, loading, error, refresh, selectWorkspace])
  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext)
  if (!ctx) throw new Error('useWorkspace must be used inside WorkspaceProvider')
  return ctx
}
