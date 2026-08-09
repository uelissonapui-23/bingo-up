import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useWorkspace } from '@/app/providers/WorkspaceProvider'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { CardTemplatePreview, previewPropsFromTemplate } from '@/components/cards/CardTemplatePreview'
import { PrintableCard } from '@/components/cards/PrintableCard'
import { getEvent } from '@/features/events/eventService'
import { ensureCardConfigDefaults, listCardTemplates, listRuleSets } from '@/features/card-config/cardConfigService'
import { buildGenerationPlan, composePhysicalCards, createUniqueGames } from '@/domain/cards/generator'
import { formatBigInt, uniqueGameCapacity } from '@/domain/cards/capacity'
import { downloadLayoutGuidePng } from '@/domain/cards/artwork'
import { getCardLayoutPreset } from '@/domain/cards/layouts'
import { parseCardTemplateOptions } from '@/domain/cards/templateOptions'
import type { BingoRuleSet, CardBatch, CardTemplate, EventWithSettings, GenerationUniquenessMode } from '@/types/database'
import { cancelCardBatch, countGameDefinitions, createCardBatch, finalizeCardBatch, listCardBatches, loadExistingCompositionSignatures, loadExistingGameDefinitions, markCardBatchFailed, persistGeneratedCards, deleteUnusedCardBatch } from './cardGenerationService'
import { listBatchCardsForPrint, type PhysicalCardView } from '@/features/cards/cardService'
type Progress = { step: string; current: number; total: number } | null

export function CardGeneratorPage() {
  const { eventId } = useParams()
  const { currentWorkspace } = useWorkspace()
  const [event, setEvent] = useState<EventWithSettings | null>(null)
  const [rules, setRules] = useState<BingoRuleSet[]>([])
  const [templates, setTemplates] = useState<CardTemplate[]>([])
  const [batches, setBatches] = useState<CardBatch[]>([])
  const [usedByRule, setUsedByRule] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [progress, setProgress] = useState<Progress>(null)

  const load = useCallback(async () => {
    if (!currentWorkspace || !eventId) return
    setLoading(true); setError(null)
    try {
      await ensureCardConfigDefaults(eventId)
      const [ev, rs, ts, bs] = await Promise.all([
        getEvent(currentWorkspace.id, eventId), listRuleSets(currentWorkspace.id, eventId), listCardTemplates(currentWorkspace.id, eventId), listCardBatches(currentWorkspace.id, eventId),
      ])
      setEvent(ev); setRules(rs.filter(r => r.is_active)); setTemplates(ts.filter(t => t.is_active)); setBatches(bs)
      const counts = await Promise.all(rs.map(async r => [r.id, await countGameDefinitions(r.id)] as const))
      setUsedByRule(Object.fromEntries(counts))
    } catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível carregar o gerador.') }
    finally { setLoading(false) }
  }, [currentWorkspace, eventId])
  useEffect(() => { void load() }, [load])

  if (loading) return <Card>Preparando o motor de geração…</Card>
  if (!event || !currentWorkspace || !eventId) return <Card><p className="text-red-700">{error ?? 'Evento não encontrado.'}</p></Card>

  return <div className="space-y-6">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-sm font-bold text-emerald-700">Cartelas · motor de geração</p><h1 className="mt-1 text-3xl font-black">{event.name}</h1><p className="mt-2 text-sm text-slate-600">Gere lotes com controle de unicidade, 1 em 1, 2 em 1 ou 3 em 1 e repetição somente quando necessária.</p></div><div className="flex flex-wrap gap-2"><Link to={`/eventos/${eventId}/cartelas/configuracao`}><Button variant="secondary">Regras e layouts</Button></Link><Link to={`/eventos/${eventId}`}><Button variant="secondary">Evento</Button></Link></div></div>
    {notice && <div className="rounded-2xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">{notice}</div>}
    {error && <div className="rounded-2xl bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</div>}
    {progress && <Card><div className="flex items-center justify-between gap-3"><div><p className="text-sm font-black">{progress.step}</p><p className="text-xs text-slate-500">{progress.current.toLocaleString('pt-BR')} de {progress.total.toLocaleString('pt-BR')}</p></div><p className="text-lg font-black">{progress.total ? Math.round(progress.current / progress.total * 100) : 0}%</p></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full bg-emerald-600 transition-all" style={{ width: `${progress.total ? progress.current / progress.total * 100 : 0}%` }} /></div></Card>}
    <GenerationForm rules={rules} templates={templates} usedByRule={usedByRule} workspaceId={currentWorkspace.id} eventId={eventId} eventName={event.name} disabled={busy} onBusy={setBusy} onProgress={setProgress} onError={setError} onDone={async message => { setNotice(message); setProgress(null); await load() }} />
    <BatchList workspaceId={currentWorkspace.id} event={event} eventId={eventId} batches={batches} busy={busy}
      onCancel={async batch => { setBusy(true); setError(null); try { await cancelCardBatch(batch.id, 'Cancelado pelo organizador.'); setNotice('Lote cancelado e suas cartelas parciais removidas.'); await load() } catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível cancelar o lote.') } finally { setBusy(false) } }}
      onDelete={async batch => {
        const ok=window.confirm(`Excluir definitivamente o lote da série ${batch.series_code}?\n\nUse isso somente para teste ou geração feita por engano. Se alguma cartela deste lote já participou de venda ou sorteio, o sistema bloqueará a exclusão.`)
        if(!ok)return
        setBusy(true);setError(null);setNotice(null)
        try{const result=await deleteUnusedCardBatch(batch.id);setNotice(`Lote excluído. ${result.deleted_cards.toLocaleString('pt-BR')} cartela(s) removida(s).`);await load()}
        catch(e){setError(e instanceof Error?friendlyDeleteError(e.message):'Não foi possível excluir o lote.')}
        finally{setBusy(false)}
      }} />
  </div>
}

function GenerationForm({ rules, templates, usedByRule, workspaceId, eventId, eventName, disabled, onBusy, onProgress, onError, onDone }:{ rules:BingoRuleSet[];templates:CardTemplate[];usedByRule:Record<string,number>;workspaceId:string;eventId:string;eventName:string;disabled:boolean;onBusy:(v:boolean)=>void;onProgress:(v:Progress)=>void;onError:(v:string|null)=>void;onDone:(message:string)=>Promise<void> }) {
  const defaultRule = rules.find(r => r.is_default) ?? rules[0]
  const [ruleId, setRuleId] = useState(defaultRule?.id ?? '')
  const [format, setFormat] = useState<1|2|3>(1)
  const compatibleTemplates = useMemo(() => templates.filter(t => t.physical_format === format), [templates, format])
  const defaultTemplate = compatibleTemplates.find(t => t.is_default) ?? compatibleTemplates[0]
  const [templateId, setTemplateId] = useState(defaultTemplate?.id ?? '')
  const [series, setSeries] = useState('A')
  const [quantity, setQuantity] = useState(100)
  const [startNumber, setStartNumber] = useState(1)
  const [padding, setPadding] = useState(5)
  const [mode, setMode] = useState<GenerationUniquenessMode>('strict')
  const rule = rules.find(r => r.id === ruleId) ?? defaultRule
  const template = compatibleTemplates.find(t => t.id === templateId) ?? defaultTemplate

  useEffect(() => { const t = templates.filter(x => x.physical_format === format); setTemplateId((t.find(x => x.is_default) ?? t[0])?.id ?? '') }, [format, templates])
  useEffect(() => { if (defaultRule && !ruleId) setRuleId(defaultRule.id) }, [defaultRule, ruleId])

  const capacity = rule ? uniqueGameCapacity({ totalBalls:rule.total_balls,numbersPerGame:rule.numbers_per_game,distributionMode:rule.distribution_mode,columns:rule.column_definitions }) : 0n
  const used = BigInt(rule ? usedByRule[rule.id] ?? 0 : 0)
  const remaining = capacity > used ? capacity - used : 0n
  const plan = buildGenerationPlan({ requestedCards: quantity, gamesPerCard: format, remainingUniqueGames: remaining, existingUniqueGames: used })
  const needsControlled = !plan.canGenerateStrict

  async function generate() {
    if (!rule || !template) { onError('Selecione uma regra e um layout compatível.'); return }
    const normalizedSeries = series.trim().toUpperCase()
    if (!/^[A-Z0-9][A-Z0-9_-]{0,19}$/.test(normalizedSeries)) { onError('A série deve ter de 1 a 20 caracteres, usando letras, números, _ ou -.'); return }
    if (quantity < 1 || quantity > 10_000) { onError('Por segurança e desempenho, gere entre 1 e 10.000 cartelas por lote. Para quantidades maiores, crie lotes adicionais.'); return }
    if (needsControlled && mode === 'strict') { onError(`Essa quantidade ultrapassa o limite sem repetição. O máximo atual é ${formatBigInt(plan.strictCardLimit)} cartelas.`); return }
    if (mode === 'controlled' && !plan.canGenerateControlled) { onError(format === 1 ? 'Não foi possível montar o plano.' : `Mesmo com repetição controlada, o máximo atual é ${formatBigInt(plan.controlledCardLimit ?? 0n)} cartelas mantendo no máximo um jogo repetido por cartela.`); return }

    onBusy(true); onError(null); onProgress({ step:'Lendo histórico de unicidade…', current:0, total:1 })
    let batchId: string | null = null
    try {
      const [existingGames, existingCompositions] = await Promise.all([loadExistingGameDefinitions(rule.id), loadExistingCompositionSignatures(rule.id)])
      const forbidden = new Set(existingGames.map(g => g.signature))
      const uniqueNeeded = Number(plan.uniqueGamesRequired)
      onProgress({ step:'Gerando jogos inéditos…', current:0, total:uniqueNeeded })
      await new Promise(resolve => setTimeout(resolve, 0))
      const uniqueGames = createUniqueGames({ rule, count:uniqueNeeded, forbiddenSignatures:forbidden })
      onProgress({ step:'Montando cartelas físicas…', current:0, total:quantity })
      const cards = composePhysicalCards({
        uniqueGames,
        repeatPool: existingGames.map(g => ({ signature:g.signature,numbers:g.numbers,cells:g.cells })),
        requestedCards:quantity,
        gamesPerCard:format,
        repeatsRequired:Number(plan.repeatedGamesRequired),
        seriesCode:normalizedSeries,
        startNumber,
        codePadding:padding,
        forbiddenCompositionSignatures:existingCompositions,
      })
      batchId = await createCardBatch({ workspaceId,eventId,rule,template,seriesCode:normalizedSeries,requestedCards:quantity,startNumber,codePadding:padding,uniquenessMode:mode,capacitySnapshot:{ total_unique_games:capacity.toString(), already_issued_unique_games:used.toString(), remaining_unique_games:remaining.toString(), strict_card_limit:plan.strictCardLimit.toString(), controlled_card_limit:plan.controlledCardLimit?.toString() ?? null }, })
      onProgress({ step:'Salvando cartelas com validação no banco…', current:0, total:quantity })
      await persistGeneratedCards(batchId,cards,100,persisted=>onProgress({ step:'Salvando cartelas com validação no banco…',current:persisted,total:quantity }))
      await finalizeCardBatch(batchId)
      await onDone(`Lote ${normalizedSeries} concluído: ${quantity.toLocaleString('pt-BR')} cartelas e ${(quantity*format).toLocaleString('pt-BR')} jogos.`)
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Falha durante a geração.'
      if (batchId) { try { await markCardBatchFailed(batchId,message) } catch { /* mantém erro original */ } }
      onError(message)
      onProgress(null)
    } finally { onBusy(false) }
  }

  if (!rule) return <Card><p className="font-semibold">Nenhuma regra ativa. Crie uma regra antes de gerar cartelas.</p></Card>
  return <Card className="border-red-900/30"><div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"><div><h2 className="text-xl font-black">Novo lote</h2><p className="mt-1 text-sm text-slate-600">Configure o lote e acompanhe ao lado uma prévia real do que será impresso.</p></div><StatusBadge tone={needsControlled?'warning':'success'}>{needsControlled?'Repetição necessária':'100% único possível'}</StatusBadge></div>
    <div className="mt-5 grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(360px,.8fr)]"><div><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <label className="text-sm font-semibold">Regra<Select className="mt-1" value={rule.id} onChange={e=>setRuleId(e.target.value)}>{rules.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}</Select></label>
      <label className="text-sm font-semibold">Formato<Select className="mt-1" value={format} onChange={e=>setFormat(Number(e.target.value) as 1|2|3)}><option value={1}>1 em 1</option><option value={2}>2 em 1</option><option value={3}>3 em 1</option></Select></label>
      <label className="text-sm font-semibold">Modelo da cartela<Select className="mt-1" value={template?.id ?? ''} onChange={e=>setTemplateId(e.target.value)}>{compatibleTemplates.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</Select></label>
      <label className="text-sm font-semibold">Série<Input className="mt-1" maxLength={20} value={series} onChange={e=>setSeries(e.target.value.toUpperCase())}/></label>
      <NumberField label="Quantidade de cartelas" value={quantity} set={setQuantity} min={1} max={10_000}/>
      <NumberField label="Primeiro número" value={startNumber} set={setStartNumber} min={1}/>
      <NumberField label="Dígitos do código" value={padding} set={setPadding} min={1} max={12}/>
      <label className="text-sm font-semibold sm:col-span-2">Política de unicidade<Select className="mt-1" value={mode} onChange={e=>setMode(e.target.value as GenerationUniquenessMode)}><option value="strict">Sem repetir nenhum jogo</option><option value="controlled">Permitir repetição controlada se necessária</option></Select></label>
    </div>
    <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4"><Metric label="Jogos únicos matemáticos" value={formatBigInt(capacity)}/><Metric label="Jogos únicos já emitidos" value={formatBigInt(used)}/><Metric label={`Máximo ${format} em 1 sem repetir`} value={formatBigInt(plan.strictCardLimit)}/><Metric label="Jogos que este lote repete" value={formatBigInt(plan.repeatedGamesRequired)} tone={plan.repeatedGamesRequired>0n?'warning':'normal'}/></div>
    {needsControlled && <div className="mt-4 rounded-2xl bg-amber-50 p-4 text-sm text-amber-900"><p className="font-black">A quantidade solicitada excede o universo ainda disponível sem repetição.</p><p className="mt-1">No modo controlado, {format===1?'repetições integrais só aparecem depois de esgotados os jogos inéditos.':`cada cartela terá no máximo 1 jogo reaproveitado e ${format-1} jogo${format-1>1?'s':''} inédito${format-1>1?'s':''}.`} {format>1&&plan.controlledCardLimit!==null&&<>O limite mantendo essa regra é {formatBigInt(plan.controlledCardLimit)} cartelas.</>}</p></div>}
    {template&&<TemplateActions eventId={eventId} template={template} format={format}/>}
    <div className="mt-5 flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-slate-500">A prévia acompanha formato, modelo, série, numeração e o coringa configurado.</p><Button disabled={disabled||!template} onClick={()=>void generate()}>{disabled?'Gerando…':'Gerar lote'}</Button></div></div>
    <div className="xl:sticky xl:top-24 xl:self-start"><div className="mb-3"><p className="text-xs font-black uppercase tracking-[.16em] text-red-400">Prévia da cartela</p><p className="mt-1 text-sm text-slate-400">Exemplo da primeira cartela deste lote.</p></div>{template?<CardTemplatePreview format={format} layoutKey={template.layout_key} eventName={eventName} seriesCode={series.trim().toUpperCase() || 'A'} sequenceNumber={startNumber} codePadding={padding} rule={rule} {...previewPropsFromTemplate(template)}/>:<div className="rounded-2xl border border-dashed border-slate-700 p-6 text-center text-sm text-slate-500">Selecione um modelo para visualizar.</div>}</div></div>
  </Card>
}

function TemplateActions({eventId,template,format}:{eventId:string;template:CardTemplate;format:1|2|3}){
  const preset=getCardLayoutPreset(template.layout_key,format)
  const wildcard=parseCardTemplateOptions(template.options).wildcard
  const labels={star:'Estrela',circle:'Bola',heart:'Coração',cross:'Símbolo',fire:'Fogueira',soccer:'Bola de futebol',custom:'Imagem personalizada',none:'Sem símbolo'} as const
  return <div className="mt-5 rounded-2xl border border-slate-700 bg-slate-950/25 p-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-black">Personalização do modelo</p><p className="mt-1 text-xs text-slate-400">Coringa atual: <strong className="text-slate-200">{labels[wildcard?.kind??'star']}</strong>. Arte de fundo e coringa são configurados no próprio layout.</p></div><div className="flex flex-wrap gap-2">{preset&&<Button variant="secondary" onClick={()=>downloadLayoutGuidePng(preset.key,format,preset.gameAreas)}>Gerar gabarito PNG</Button>}<Link to={`/eventos/${eventId}/cartelas/configuracao?aba=layouts&editar=${template.id}`}><Button variant="secondary">Personalizar este modelo</Button></Link></div></div></div>
}

function BatchList({ workspaceId,event,eventId,batches,busy,onCancel,onDelete }:{workspaceId:string;event:EventWithSettings;eventId:string;batches:CardBatch[];busy:boolean;onCancel:(batch:CardBatch)=>Promise<void>;onDelete:(batch:CardBatch)=>Promise<void>}) {
  const completed=batches.filter(batch=>batch.status==='completed')
  return <div className="space-y-3"><div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><h2 className="text-xl font-black">Lotes gerados</h2><p className="text-sm text-slate-600">Confira uma cartela real do lote antes de imprimir. Se o lote foi só um teste ou saiu errado, você pode excluí-lo enquanto nenhuma cartela tiver sido usada.</p></div>{completed.length>0&&<Link to={`/eventos/${eventId}/cartelas`}><Button variant="secondary">Ver todas as cartelas</Button></Link>}</div>{batches.length===0?<Card><p className="text-sm text-slate-500">Nenhum lote gerado ainda.</p></Card>:<div className="grid gap-4 xl:grid-cols-2">{batches.map(batch=><Card key={batch.id}><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wide text-slate-500">Série {batch.series_code}</p><h3 className="mt-1 text-lg font-black">{batch.requested_cards.toLocaleString('pt-BR')} cartelas · {batch.physical_format} em 1</h3></div><StatusBadge tone={batch.status==='completed'?'success':batch.status==='failed'?'danger':batch.status==='canceled'?'warning':'neutral'}>{batchStatus[batch.status]}</StatusBadge></div><div className="mt-4 grid grid-cols-2 gap-3 text-sm"><Mini label="Cartelas gravadas" value={`${batch.generated_cards.toLocaleString('pt-BR')} / ${batch.requested_cards.toLocaleString('pt-BR')}`}/><Mini label="Jogos internos" value={batch.generated_games.toLocaleString('pt-BR')}/><Mini label="Jogos inéditos" value={batch.unique_games_created.toLocaleString('pt-BR')}/><Mini label="Reaproveitados" value={batch.reused_games.toLocaleString('pt-BR')}/></div>{batch.error_message&&<p className="mt-3 rounded-xl bg-red-50 p-3 text-xs text-red-700">{batch.error_message}</p>}{batch.status==='completed'&&<><RealBatchPreview workspaceId={workspaceId} event={event} eventId={eventId} batch={batch}/><div className="mt-4 grid gap-2 sm:grid-cols-2"><Link to={`/eventos/${eventId}/cartelas?lote=${batch.id}`}><Button variant="secondary" className="w-full">Ver todas</Button></Link><Link to={`/eventos/${eventId}/cartelas/lote/${batch.id}/imprimir`}><Button className="w-full">Gerar / Imprimir PDF</Button></Link></div></>}{['generating','failed'].includes(batch.status)&&<div className="mt-4"><Button variant="secondary" disabled={busy} onClick={()=>void onCancel(batch)}>Cancelar e limpar lote</Button></div>}{batch.status!=='generating'&&<div className="mt-2 flex justify-end"><button type="button" disabled={busy} onClick={()=>void onDelete(batch)} className="rounded-lg px-3 py-2 text-xs font-bold text-red-400 transition hover:bg-red-950/35 hover:text-red-300 disabled:opacity-50">Excluir lote de teste</button></div>}</Card>)}</div>}</div>
}

function RealBatchPreview({workspaceId,event,eventId,batch}:{workspaceId:string;event:EventWithSettings;eventId:string;batch:CardBatch}){
  const [card,setCard]=useState<PhysicalCardView|null>(null)
  const [loading,setLoading]=useState(true)
  const [expanded,setExpanded]=useState(false)
  const [previewError,setPreviewError]=useState<string|null>(null)

  useEffect(()=>{
    let active=true
    setLoading(true);setPreviewError(null)
    void listBatchCardsForPrint(workspaceId,eventId,batch.id,0,1)
      .then(rows=>{if(active)setCard(rows[0]??null)})
      .catch(()=>{if(active)setPreviewError('Não foi possível carregar a miniatura.')})
      .finally(()=>{if(active)setLoading(false)})
    return()=>{active=false}
  },[workspaceId,eventId,batch.id])

  if(loading)return <div className="mt-4 rounded-2xl border border-slate-700 bg-slate-950/30 p-4 text-sm text-slate-400">Montando miniatura real da primeira cartela…</div>
  if(previewError||!card)return <div className="mt-4 rounded-2xl border border-slate-700 bg-slate-950/30 p-4 text-sm text-slate-400">{previewError??'Miniatura indisponível.'}</div>

  return <div className="mt-4 rounded-2xl border border-slate-700 bg-slate-950/35 p-4">
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
      <div><p className="text-sm font-black text-slate-100">Prévia real da cartela</p><p className="text-xs text-slate-400">Primeira cartela do lote, com números, arte e coringa realmente salvos.</p></div>
      <Button variant="secondary" onClick={()=>setExpanded(true)}>Expandir e conferir detalhes</Button>
    </div>
    <button type="button" onClick={()=>setExpanded(true)} className="group mx-auto block w-full max-w-[290px] cursor-zoom-in rounded-2xl border border-slate-700 bg-slate-900 p-2 text-left shadow-xl transition hover:border-red-500/70" aria-label="Expandir prévia da cartela">
      <div className="aspect-[210/297] overflow-hidden rounded-xl bg-white">
        <PrintableCard card={card} event={event}/>
      </div>
      <p className="mt-2 text-center text-xs font-bold text-slate-300">Cartela {card.code} · toque para ampliar</p>
    </button>
    {expanded&&<div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/85 p-3 sm:p-6" role="dialog" aria-modal="true" aria-label="Prévia ampliada da cartela" onClick={()=>setExpanded(false)}>
      <div className="flex h-full max-h-[96vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-slate-700 bg-slate-950 shadow-2xl" onClick={e=>e.stopPropagation()}>
        <div className="flex items-center justify-between gap-3 border-b border-slate-800 p-3 sm:p-4">
          <div className="min-w-0"><p className="font-black text-white">Cartela {card.code}</p><p className="truncate text-xs text-slate-400">Visualização ampliada antes do PDF</p></div>
          <Button variant="secondary" onClick={()=>setExpanded(false)}>Fechar</Button>
        </div>
        <div className="min-h-0 flex-1 overflow-auto p-3 sm:p-6">
          <div className="mx-auto w-full max-w-[760px]">
            <div className="aspect-[210/297] overflow-hidden rounded-xl bg-white shadow-2xl">
              <PrintableCard card={card} event={event}/>
            </div>
          </div>
        </div>
      </div>
    </div>}
  </div>
}

function friendlyDeleteError(message:string){
  const lower=message.toLowerCase()
  if(lower.includes('sale')||lower.includes('venda'))return 'Este lote não pode ser excluído porque já possui cartela vinculada a venda ou reserva. Cancele a operação primeiro, se isso ainda for permitido.'
  if(lower.includes('draw')||lower.includes('sorteio')||lower.includes('winner'))return 'Este lote não pode ser excluído porque já participou de sorteio ou premiação. O histórico precisa ser preservado.'
  return message||'Não foi possível excluir o lote.'
}

const batchStatus:Record<CardBatch['status'],string>={draft:'Rascunho',generating:'Gerando',completed:'Concluído',failed:'Falhou',canceled:'Cancelado'}
function Metric({label,value,tone='normal'}:{label:string;value:string;tone?:'normal'|'warning'}){return <div className={`rounded-2xl p-4 ${tone==='warning'?'bg-amber-50':'bg-slate-50'}`}><p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-1 break-all text-lg font-black">{value}</p></div>}
function Mini({label,value}:{label:string;value:string}){return <div><p className="text-xs font-semibold text-slate-500">{label}</p><p className="mt-1 font-black">{value}</p></div>}
function NumberField({label,value,set,min,max}:{label:string;value:number;set:(n:number)=>void;min:number;max?:number}){return <label className="text-sm font-semibold">{label}<Input className="mt-1" type="number" min={min} max={max} value={value} onChange={e=>set(Number(e.target.value))}/></label>}
