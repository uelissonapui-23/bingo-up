import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useWorkspace } from '@/app/providers/WorkspaceProvider'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { deleteUnusedCardBatch, listCardBatches } from '@/features/card-generator/cardGenerationService'
import { listEventCards } from './cardService'
import { downloadLayoutGuidePng } from '@/domain/cards/artwork'
import { getCardLayoutPreset } from '@/domain/cards/layouts'
import type { CardBatch, PhysicalCard, PhysicalCardStatus } from '@/types/database'

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
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!currentWorkspace || !eventId) return
    setLoading(true)
    setError(null)
    try {
      const [batchRows, cardRows] = await Promise.all([
        listCardBatches(currentWorkspace.id, eventId),
        listEventCards(currentWorkspace.id, eventId, { batchId: batchId || undefined, status: (status || undefined) as PhysicalCardStatus | undefined, search: search || undefined }),
      ])
      setBatches(batchRows)
      setCards(cardRows as CardListItem[])
    } catch {
      setError('Não foi possível carregar as cartelas.')
    } finally {
      setLoading(false)
    }
  }, [currentWorkspace, eventId, batchId, status, search])

  useEffect(() => { void load() }, [load])

  const completedBatches = useMemo(() => batches.filter((batch) => batch.status === 'completed' && batch.generated_cards > 0), [batches])
  const counts = useMemo(() => cards.reduce((acc, card) => { acc[card.status] = (acc[card.status] ?? 0) + 1; return acc }, {} as Record<string, number>), [cards])
  const selectedBatch = completedBatches.find((batch) => batch.id === batchId)

  function chooseBatch(value: string) {
    setBatchId(value)
    const next = new URLSearchParams(searchParams)
    if (value) next.set('lote', value)
    else next.delete('lote')
    setSearchParams(next, { replace: true })
  }


  function downloadBatchGuide(batch: CardBatch) {
    const snapshot = (batch.generation_options?.template_snapshot ?? null) as { layout_key?: string; physical_format?: number } | null
    const format = (snapshot?.physical_format ?? batch.physical_format) as 1 | 2 | 3
    const preset = getCardLayoutPreset(snapshot?.layout_key ?? '', format)
    if (!preset) { setError('Não foi possível localizar o layout usado neste lote.'); return }
    downloadLayoutGuidePng(preset.key, format, preset.gameAreas)
  }

  async function removeBatch(batch: CardBatch) {
    if (!confirm(`Excluir o lote Série ${batch.series_code}? Só é possível excluir lotes cujas cartelas ainda não foram usadas em vendas, reservas ou sorteios.`)) return
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      await deleteUnusedCardBatch(batch.id)
      if (batchId === batch.id) chooseBatch('')
      setNotice(`Lote Série ${batch.series_code} excluído.`)
      await load()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Este lote não pode ser excluído porque já possui uso vinculado.')
    } finally {
      setBusy(false)
    }
  }

  return <div className="space-y-6">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="bingoup-eyebrow">Cartelas</p>
        <h1 className="text-3xl font-black text-white">Gerenciar cartelas</h1>
        <p className="mt-1 text-sm text-slate-400">Somente cartelas já geradas. Aqui você consulta, visualiza, configura impressão, gera PDF e exclui lotes ainda não utilizados.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Link to="/cartelas"><Button variant="secondary">Todos os eventos</Button></Link>
        <Link to={`/eventos/${eventId}`}><Button variant="secondary">Voltar ao evento</Button></Link>
      </div>
    </div>

    {notice && <div className="rounded-2xl border border-emerald-800/40 bg-emerald-950/20 p-4 text-sm font-semibold text-emerald-300">{notice}</div>}
    {error && <div className="rounded-2xl border border-red-900/40 bg-red-950/25 p-4 text-red-300">{error}</div>}

    <div className="grid gap-3 sm:grid-cols-4">
      <Metric t="Exibidas" v={cards.length}/>
      <Metric t="Disponíveis" v={counts.available ?? 0}/>
      <Metric t="Vendidas" v={counts.sold ?? 0}/>
      <Metric t="Anuladas" v={counts.void ?? 0}/>
    </div>

    <Card>
      <div className="flex flex-col gap-4">
        <div>
          <h2 className="text-lg font-black text-white">Lotes gerados</h2>
          <p className="mt-1 text-sm text-slate-400">Escolha um lote para visualizar suas cartelas ou abrir a configuração de impressão e PDF.</p>
        </div>
        {completedBatches.length === 0 ? <p className="text-sm text-slate-500">Nenhum lote concluído neste evento.</p> : <div className="grid gap-3 lg:grid-cols-2">{completedBatches.map((batch) => <div key={batch.id} className={`rounded-2xl border p-4 ${batch.id === batchId ? 'border-red-600 bg-red-950/15' : 'border-slate-700 bg-slate-950/30'}`}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-wide text-slate-500">Série {batch.series_code}</p>
              <p className="mt-1 font-black text-white">{batch.generated_cards.toLocaleString('pt-BR')} cartelas · {batch.physical_format} em 1</p>
            </div>
            <StatusBadge tone="success">Concluído</StatusBadge>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <Button variant="secondary" disabled={busy} onClick={() => chooseBatch(batch.id)}>{batch.id === batchId ? 'Lote selecionado' : 'Visualizar cartelas'}</Button>
            <Link to={`/eventos/${eventId}/cartelas/lote/${batch.id}/imprimir`}><Button className="w-full">Impressão / PDF</Button></Link><Button variant="secondary" className="sm:col-span-2" onClick={()=>downloadBatchGuide(batch)}>Baixar gabarito PNG</Button>
          </div>
          <div className="mt-2 flex justify-end"><button type="button" disabled={busy} onClick={() => void removeBatch(batch)} className="rounded-lg px-3 py-2 text-xs font-bold text-red-400 transition hover:bg-red-950/35 hover:text-red-300 disabled:opacity-50">Excluir lote</button></div>
        </div>)}</div>}
      </div>
    </Card>

    <Card>
      <div className="grid gap-3 md:grid-cols-3">
        <label className="text-sm font-semibold">Buscar código<Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Ex.: A-000125" className="mt-1"/></label>
        <label className="text-sm font-semibold">Lote<Select value={batchId} onChange={(event) => chooseBatch(event.target.value)} className="mt-1"><option value="">Todos os lotes</option>{completedBatches.map((batch) => <option key={batch.id} value={batch.id}>{batch.series_code} · {batch.generated_cards} cartelas</option>)}</Select></label>
        <label className="text-sm font-semibold">Status<Select value={status} onChange={(event) => setStatus(event.target.value)} className="mt-1"><option value="">Todos</option>{Object.entries(labels).map(([key, value]) => <option key={key} value={key}>{value}</option>)}</Select></label>
      </div>
      {selectedBatch && <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-900/30 bg-red-950/15 p-3"><p className="text-sm text-slate-300"><strong className="text-white">Série {selectedBatch.series_code}</strong> · {selectedBatch.physical_format} em 1 · {selectedBatch.generated_cards} cartelas</p><div className="flex flex-wrap items-center gap-3"><button type="button" onClick={()=>downloadBatchGuide(selectedBatch)} className="text-sm font-black text-sky-400 hover:text-sky-300">Baixar gabarito PNG</button><Link to={`/eventos/${eventId}/cartelas/lote/${selectedBatch.id}/imprimir`} className="text-sm font-black text-red-400">Configurar impressão / PDF →</Link></div></div>}
    </Card>

    {loading ? <Card>Carregando…</Card> : cards.length === 0 ? <Card>Nenhuma cartela encontrada.</Card> : <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{cards.map((card) => <Link key={card.id} to={`/eventos/${eventId}/cartelas/${card.id}`} className="rounded-2xl border border-slate-700 bg-slate-900/65 p-4 shadow-sm transition hover:border-red-700"><div className="flex items-center justify-between gap-3"><div className="min-w-0"><p className="break-words text-lg font-black text-white">{card.code}</p><p className="text-xs text-slate-500">{card.physical_format} em 1 · Série {card.batch.series_code}</p></div><StatusBadge tone={card.status === 'available' ? 'success' : card.status === 'sold' ? 'info' : card.status === 'void' ? 'danger' : 'neutral'}>{labels[card.status]}</StatusBadge></div></Link>)}</div>}
  </div>
}

function Metric({ t, v }: { t: string; v: number }) { return <Card><p className="text-xs font-bold uppercase text-slate-500">{t}</p><p className="mt-1 text-2xl font-black text-white">{v}</p></Card> }
