import { useEffect, useState } from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { isPlatformOwner } from '@/features/master/masterService'

export function RequirePlatformOwner() {
  const [allowed, setAllowed] = useState<boolean | null>(null)
  useEffect(() => { let active = true; void isPlatformOwner().then(v => { if (active) setAllowed(v) }).catch(() => { if (active) setAllowed(false) }); return () => { active = false } }, [])
  if (allowed === null) return <div className="bingoup-app grid min-h-dvh place-items-center text-sm text-slate-400">Validando acesso Master…</div>
  if (!allowed) return <Navigate to="/" replace />
  return <Outlet />
}
