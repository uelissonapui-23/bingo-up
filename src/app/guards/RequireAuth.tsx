import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '@/app/providers/AuthProvider'

export function RequireAuth() {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) return <main className="grid min-h-dvh place-items-center p-6">Carregando…</main>
  if (!user) return <Navigate to="/entrar" replace state={{ from: location.pathname }} />
  return <Outlet />
}
