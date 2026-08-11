import { useCallback, useEffect, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { AccessPendingPage } from '@/features/support/AccessPendingPage'
import { getMyPlatformAccess, type PlatformAccessState } from '@/features/support/supportService'

export function RequirePlatformAccess() {
  const [state, setState] = useState<PlatformAccessState | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setError(null)
    try { setState(await getMyPlatformAccess()) }
    catch { setError('Não foi possível verificar seu acesso. Tente novamente.') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { void refresh() }, [refresh])
  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === 'visible') void refresh() }
    window.addEventListener('online', refresh)
    document.addEventListener('visibilitychange', onVisible)
    return () => { window.removeEventListener('online', refresh); document.removeEventListener('visibilitychange', onVisible) }
  }, [refresh])

  if (loading) return <div className="bingoup-app min-h-dvh p-8 text-sm text-slate-400">Verificando acesso…</div>
  if (error || !state) return <div className="bingoup-app min-h-dvh p-8"><div className="mx-auto max-w-lg rounded-2xl border border-red-900/50 bg-slate-900 p-5 text-sm text-red-300"><p>{error}</p><button className="mt-3 rounded-xl border border-slate-700 px-4 py-2 font-bold text-white" onClick={() => void refresh()}>Tentar novamente</button></div></div>
  if (state.allowed || state.is_master) return <Outlet />
  return <AccessPendingPage access={state} onRefresh={refresh} />
}
