import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '@/app/providers/AuthProvider'

export function RequireAuth() {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) return <main className="grid min-h-dvh place-items-center p-6">Carregando…</main>
  if (!user) {
    const from=`${location.pathname}${location.search}`
    return <Navigate to={`/entrar?next=${encodeURIComponent(from)}`} replace />
  }
  return <Outlet />
}
