import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useWorkspace } from '@/app/providers/WorkspaceProvider'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { listCardBatches } from '@/features/card-generator/cardGenerationService'
import { listEventCards } from './cardService'
import type { CardBatch, PhysicalCard, PhysicalCardStatus } from '@/types/database'
import { EventFlowNav } from '@/components/events/EventFlowNav'

const labels: Record<PhysicalCardStatus, string> = { available:'Disponível', reserved:'Reservada', sold:'Vendida', canceled:'Cancelada', void:'Anulada' }
type CardListItem = PhysicalCard & { batch: CardBatch }

export function CardsPage() {
  const { eventId } = useParams()
  const { currentWorkspace } = useWorkspace()
  const [searchParams, setSearchParams] = useSearchParams()
  const [batches, setBatches] = useState<CardBatch[]>([])
  const [cards, setCards] = useState<CardListItem[]>([])
  const [batchId, setBatchId] = useState(() => searchParams.get('lote') ?? '')
  const [status, setStatus] = useState('')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!currentWorkspace || !eventId) return
    setLoading(true); setError(null)
    try {
      const [batchRows, cardRows] = await Promise.all([
        listCardBatches(currentWorkspace.id, eventId),
        listEventCards(currentWorkspace.id, eventId, { batchId: batchId || undefined, status: (status || undefined) as PhysicalCardStatus | undefined, search: search || undefined }),
      ])
      setBatches(batchRows); setCards(cardRows as CardListItem[])
    } catch { setError('Não foi possível carregar as cartelas.') }
    finally { setLoading(false) }
  }, [currentWorkspace, eventId, batchId, status, search])
  useEffect(() => { void load() }, [load])

  const counts = useMemo(() => cards.reduce((acc, card) => { acc[card.status] = (acc[card.status] ?? 0) + 1; return acc }, {} as Record<string, number>), [cards])
  const selectedBatch = batches.find((batch) => batch.id === batchId)

  function chooseBatch(value: string) {
    setBatchId(value)
    const next = new URLSearchParams(searchParams)
    if (value) next.set('lote', value); else next.delete('lote')
    setSearchParams(next, { replace: true })
  }

  return <div className="space-y-6">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><p className="bingoup-eyebrow">Cartelas</p><h1 className="text-3xl font-black text-white">Cartelas emitidas</h1><p className="mt-1 text-sm text-slate-400">Consulte cada cartela e escolha um lote para imprimir ou gerar PDF.</p></div><div className="flex flex-wrap gap-2"><Link to={`/eventos/${eventId}/cartelas/gerar`}><Button>+ Gerar lote</Button></Link><Link to={`/eventos/${eventId}/cartelas/configuracao`}><Button variant="secondary">Layouts</Button></Link>{batchId && <Link to={`/eventos/${eventId}/cartelas/lote/${batchId}/imprimir`}><Button variant="secondary">Imprimir / Gerar PDF</Button></Link>}</div></div>
    {eventId&&<EventFlowNav eventId={eventId} current="cards"/>}
    <div className="grid gap-3 sm:grid-cols-4"><Metric t="Exibidas" v={cards.length}/><Metric t="Disponíveis" v={counts.available ?? 0}/><Metric t="Vendidas" v={counts.sold ?? 0}/><Metric t="Anuladas" v={counts.void ?? 0}/></div>
    <Card><div className="grid gap-3 md:grid-cols-3"><label className="text-sm font-semibold">Buscar código<Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Ex.: A-000125" className="mt-1"/></label><label className="text-sm font-semibold">Lote<Select value={batchId} onChange={(event) => chooseBatch(event.target.value)} className="mt-1"><option value="">Todos</option>{batches.filter((batch) => batch.status === 'completed').map((batch) => <option key={batch.id} value={batch.id}>{batch.series_code} · {batch.generated_cards} cartelas</option>)}</Select></label><label className="text-sm font-semibold">Status<Select value={status} onChange={(event) => setStatus(event.target.value)} className="mt-1"><option value="">Todos</option>{Object.entries(labels).map(([key, value]) => <option key={key} value={key}>{value}</option>)}</Select></label></div>{selectedBatch && <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-900/30 bg-red-950/15 p-3"><p className="text-sm text-slate-300"><strong className="text-white">Série {selectedBatch.series_code}</strong> · {selectedBatch.physical_format} em 1 · {selectedBatch.generated_cards} cartelas</p><Link to={`/eventos/${eventId}/cartelas/lote/${selectedBatch.id}/imprimir`} className="text-sm font-black text-red-400">Abrir impressão / PDF →</Link></div>}</Card>
    {error && <div className="rounded-2xl border border-red-900/40 bg-red-950/25 p-4 text-red-300">{error}</div>}
    {loading ? <Card>Carregando…</Card> : cards.length === 0 ? <Card>Nenhuma cartela encontrada.</Card> : <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{cards.map((card) => <Link key={card.id} to={`/eventos/${eventId}/cartelas/${card.id}`} className="rounded-2xl border border-slate-700 bg-slate-900/65 p-4 shadow-sm transition hover:border-red-700"><div className="flex items-center justify-between gap-3"><div className="min-w-0"><p className="break-words text-lg font-black text-white">{card.code}</p><p className="text-xs text-slate-500">{card.physical_format} em 1 · Série {card.batch.series_code}</p></div><StatusBadge tone={card.status === 'available' ? 'success' : card.status === 'sold' ? 'info' : card.status === 'void' ? 'danger' : 'neutral'}>{labels[card.status]}</StatusBadge></div></Link>)}</div>}
  </div>
}

function Metric({ t, v }: { t: string; v: number }) { return <Card><p className="text-xs font-bold uppercase text-slate-500">{t}</p><p className="mt-1 text-2xl font-black text-white">{v}</p></Card> }
