import { Navigate, Outlet } from 'react-router-dom'
import { useWorkspace } from '@/app/providers/WorkspaceProvider'

export function RequireWorkspace() {
  const { currentWorkspace, loading, error, refresh } = useWorkspace()
  if (loading && !currentWorkspace) return <div className="p-8 text-sm text-slate-600">Carregando espaço do organizador...</div>
  if (currentWorkspace) return <Outlet />
  if (error) return <div className="p-8 text-sm text-red-700"><p>{error}</p><button className="mt-3 rounded-xl border px-4 py-2 font-semibold" onClick={()=>void refresh()}>Tentar novamente</button></div>
  return <Navigate to="/configurar-organizador" replace />
}
