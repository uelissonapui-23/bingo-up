import { Navigate, Outlet } from 'react-router-dom'
import { useWorkspace } from '@/app/providers/WorkspaceProvider'

export function RequireWorkspace() {
  const { currentWorkspace, loading, error } = useWorkspace()
  if (loading) return <div className="p-8 text-sm text-slate-600">Carregando espaço do organizador...</div>
  if (error) return <div className="p-8 text-sm text-red-700">{error}</div>
  if (!currentWorkspace) return <Navigate to="/configurar-organizador" replace />
  return <Outlet />
}
