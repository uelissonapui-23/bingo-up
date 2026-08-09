import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useWorkspace } from '@/app/providers/WorkspaceProvider'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { archiveEvent, listEvents, restoreEvent } from './eventService'
import { eventStatusLabel, eventStatusTone, formatEventDate } from './eventUtils'
import type { EventWithSettings } from '@/types/database'

export function EventsPage() {
  const { currentWorkspace } = useWorkspace()
  const [events, setEvents] = useState<EventWithSettings[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [includeArchived, setIncludeArchived] = useState(false)

  const load = useCallback(async () => {
    if (!currentWorkspace) return
    setLoading(true); setError(null)
    try { setEvents(await listEvents(currentWorkspace.id, includeArchived)) }
    catch { setError('Não foi possível carregar os eventos.') }
    finally { setLoading(false) }
  }, [currentWorkspace, includeArchived])

  useEffect(() => { void load() }, [load])
  const activeCount = useMemo(() => events.filter(e => !['finished','canceled','archived'].includes(e.status)).length, [events])

  async function toggleArchive(event: EventWithSettings) {
    if (!confirm(event.status === 'archived' ? `Restaurar ${event.name}?` : `Arquivar ${event.name}?`)) return
    try { if (event.status === 'archived') await restoreEvent(event.id); else await archiveEvent(event.id); await load() }
    catch { setError('Não foi possível alterar o arquivamento do evento.') }
  }

  return <div className="space-y-6">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div><p className="text-sm font-semibold text-emerald-700">Eventos</p><h1 className="mt-1 text-3xl font-black tracking-tight">Seus bingos</h1><p className="mt-2 text-sm text-slate-600">Cada evento mantém cartelas, vendas, sorteios e premiações isolados.</p></div>
      <Link to="/eventos/novo"><Button>Novo evento</Button></Link>
    </div>
    <div className="grid gap-4 sm:grid-cols-3"><Stat label="Total carregado" value={events.length}/><Stat label="Em operação" value={activeCount}/><Stat label="Organizador" value={currentWorkspace?.name ?? '—'}/></div>
    <label className="flex items-center gap-2 text-sm font-medium text-slate-700"><input type="checkbox" checked={includeArchived} onChange={e=>setIncludeArchived(e.target.checked)} /> Mostrar arquivados</label>
    {error && <div className="rounded-2xl bg-red-50 p-4 text-sm font-medium text-red-700">{error}</div>}
    {loading ? <Card>Carregando eventos…</Card> : events.length === 0 ? <EmptyState title="Nenhum evento criado" description="Crie o primeiro evento para começar a preparar cartelas e vendas."/> : <div className="grid gap-4 xl:grid-cols-2">{events.map(event => <Card key={event.id} className="p-0 overflow-hidden"><div className="p-5"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><h2 className="truncate text-xl font-black">{event.name}</h2><p className="mt-1 text-sm text-slate-500">{formatEventDate(event.starts_at)}</p></div><StatusBadge tone={eventStatusTone(event.status)}>{eventStatusLabel[event.status]}</StatusBadge></div><div className="mt-4 grid gap-2 text-sm text-slate-600 sm:grid-cols-2"><p><b>Local:</b> {event.location_name || 'Não definido'}</p><p><b>Valor padrão:</b> {new Intl.NumberFormat('pt-BR',{style:'currency',currency:event.settings?.currency ?? 'BRL'}).format(Number(event.settings?.default_card_price ?? 0))}</p><p className="break-words"><b>Código público:</b> {event.public_code}</p><p className="break-words"><b>Identificador:</b> {event.slug}</p></div><div className="mt-5 flex flex-wrap gap-2"><Link to={`/eventos/${event.id}`}><Button>Gerenciar</Button></Link><Link to={`/eventos/${event.id}/editar`}><Button variant="secondary">Editar</Button></Link><Button variant="secondary" onClick={()=>void toggleArchive(event)}>{event.status === 'archived' ? 'Restaurar' : 'Arquivar'}</Button></div></div></Card>)}</div>}
  </div>
}

function Stat({label,value}:{label:string;value:string|number}) { return <Card><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-2 text-2xl font-black">{value}</p></Card> }
