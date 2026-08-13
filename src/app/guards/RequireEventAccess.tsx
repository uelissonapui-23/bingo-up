import { useEffect, useState } from 'react'
import { Navigate, Outlet, useParams } from 'react-router-dom'
import { listMyAccessCenters, type AccessCenters } from '@/features/access/accessService'

type EventAccessRole = 'seller' | 'operator' | 'buyer'

function hasEventAccess(data: AccessCenters, role: EventAccessRole, eventId: string) {
  if (data.is_master) return true
  if (role === 'seller') return data.seller_events.some(item => item.event_id === eventId)
  if (role === 'operator') return data.operator_events.some(item => item.event_id === eventId)
  return data.buyer_events.some(item => item.event_id === eventId)
}

export function RequireEventAccess({ role }: { role: EventAccessRole }) {
  const { eventId } = useParams()
  const [allowed, setAllowed] = useState<boolean | null>(null)

  useEffect(() => {
    let active = true
    if (!eventId) { setAllowed(false); return () => { active = false } }
    void listMyAccessCenters()
      .then(data => { if (active) setAllowed(hasEventAccess(data, role, eventId)) })
      .catch(() => { if (active) setAllowed(false) })
    return () => { active = false }
  }, [eventId, role])

  if (allowed === null) return <div className="bingoup-app grid min-h-dvh place-items-center text-sm text-slate-400">Validando acesso ao evento…</div>
  if (!allowed) return <Navigate to={role === 'seller' ? '/venda' : role === 'operator' ? '/operador' : '/cliente'} replace />
  return <Outlet />
}
