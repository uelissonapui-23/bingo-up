import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useWorkspace } from '@/app/providers/WorkspaceProvider'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { listEvents } from '@/features/events/eventService'
import { listCardBatches } from '@/features/card-generator/cardGenerationService'
import type { CardBatch, EventWithSettings } from '@/types/database'

type EventCardsSummary = { event: EventWithSettings; batches: CardBatch[] }

export function CardsHubPage() {
  const { currentWorkspace } = useWorkspace()
  const [items, setItems] = useState<EventCardsSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!currentWorkspace) return
    setLoading(true); setError(null)
    try {
      const events = await listEvents(currentWorkspace.id)
      const summaries = await Promise.all(events.map(async (event) => ({ event, batches: await listCardBatches(currentWorkspace.id, event.id) })))
      setItems(summaries)
    } catch {
      setError('Não foi possível carregar os eventos e lotes de cartelas.')
    } finally { setLoading(false) }
  }, [currentWorkspace])

  useEffect(() => { void load() }, [load])

  return <div className="space-y-6">
    <div className="bingoup-page-head"><div><p className="bingoup-eyebrow">Cartelas</p><h1>Central de cartelas</h1><p>Gere, visualize, imprima e salve em PDF os lotes de cada evento.</p></div><Link to="/eventos"><Button variant="secondary">Ver eventos</Button></Link></div>
    {error && <div className="rounded-2xl border border-red-900/50 bg-red-950/30 p-4 text-sm font-semibold text-red-300">{error}</div>}
    {loading ? <Card>Carregando cartelas…</Card> : items.length === 0 ? <Card><div className="bingoup-empty"><span className="bingoup-empty-icon">+</span><strong>Nenhum evento criado ainda.</strong><p>Crie um evento para começar a gerar cartelas.</p><Link className="mt-4" to="/eventos/novo"><Button>+ Novo evento</Button></Link></div></Card> : <div className="grid gap-4 xl:grid-cols-2">{items.map(({ event, batches }) => {
      const completed = batches.filter((batch) => batch.status === 'completed')
      const totalCards = completed.reduce((sum, batch) => sum + batch.generated_cards, 0)
      const latest = completed[0]
      return <Card key={event.id} className="overflow-hidden">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[.16em] text-red-400">Evento</p><h2 className="mt-1 text-xl font-black text-white">{event.name}</h2><p className="mt-1 text-sm text-slate-400">{completed.length} lote(s) concluído(s) · {totalCards.toLocaleString('pt-BR')} cartela(s)</p></div><Link to={`/eventos/${event.id}`} className="text-sm font-bold text-red-400 hover:text-red-300">Abrir evento →</Link></div>
        <div className="mt-5 grid gap-2 sm:grid-cols-3"><Link to={`/eventos/${event.id}/cartelas/gerar`}><Button className="w-full">Gerar cartelas</Button></Link><Link to={`/eventos/${event.id}/cartelas`}><Button variant="secondary" className="w-full">Ver cartelas</Button></Link><Link to={`/eventos/${event.id}/cartelas/configuracao`}><Button variant="secondary" className="w-full">Layouts</Button></Link></div>
        {latest ? <div className="mt-4 rounded-2xl border border-slate-700 bg-slate-950/40 p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase text-slate-500">Último lote</p><p className="mt-1 font-black text-white">Série {latest.series_code} · {latest.generated_cards} cartelas · {latest.physical_format} em 1</p></div><Link to={`/eventos/${event.id}/cartelas/lote/${latest.id}/imprimir`}><Button variant="secondary">Imprimir / PDF</Button></Link></div></div> : <p className="mt-4 rounded-2xl border border-dashed border-slate-700 p-4 text-sm text-slate-500">Ainda não há lote concluído neste evento.</p>}
      </Card>
    })}</div>}
  </div>
}
