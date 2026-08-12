import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useWorkspace } from '@/app/providers/WorkspaceProvider'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { CardTemplatePreview } from '@/components/cards/CardTemplatePreview'
import { WildcardSymbol } from '@/components/cards/WildcardSymbol'
import { PrintableCard } from '@/components/cards/PrintableCard'
import { getEvent } from '@/features/events/eventService'
import { ensureCardConfigDefaults, getCardAssetUrl, getEventCardArtwork, getEventCardGameStyle, getEventCardWildcard, listCardTemplates, listRuleSets, saveEventCardArtwork, saveEventCardGameStyle, saveEventCardWildcard } from '@/features/card-config/cardConfigService'
import { buildGenerationPlan, composePhysicalCards, createUniqueGames } from '@/domain/cards/generator'
import { formatBigInt, uniqueGameCapacity } from '@/domain/cards/capacity'
import { optimizeArtwork, optimizeWildcard } from '@/domain/cards/artwork'
import { DEFAULT_GAME_STYLE, DEFAULT_WILDCARD, parseCardTemplateOptions, type ArtworkFit, type ArtworkQuality, type CardArtworkOptions, type CardGameFont, type CardGameStyleOptions, type CardTemplateOptions, type CardWildcardOptions, type WildcardKind } from '@/domain/cards/templateOptions'
import type { BingoRuleSet, CardBatch, CardTemplate, EventWithSettings, GenerationUniquenessMode } from '@/types/database'
import { cancelCardBatch, countGameDefinitions, createCardBatch, finalizeCardBatch, listCardBatches, loadExistingCompositionSignatures, loadExistingGameDefinitions, markCardBatchFailed, persistGeneratedCards, deleteUnusedCardBatch } from './cardGenerationService'
import { listBatchCardsForPrint, type PhysicalCardView } from '@/features/cards/cardService'
type Progress = { step: string; current: number; total: number } | null

export function CardGeneratorPage() {
  const { eventId } = useParams()
  const [searchParams] = useSearchParams()
  const { currentWorkspace } = useWorkspace()
  const workspaceId = currentWorkspace?.id ?? null
  const hasLoadedRef = useRef(false)
  const [event, setEvent] = useState<EventWithSettings | null>(null)
  const [rules, setRules] = useState<BingoRuleSet[]>([])
  const [templates, setTemplates] = useState<CardTemplate[]>([])
  const [eventArtwork, setEventArtwork] = useState<CardArtworkOptions | undefined>(undefined)
  const [eventGameStyle, setEventGameStyle] = useState<CardGameStyleOptions>(DEFAULT_GAME_STYLE)
  const [eventWildcard, setEventWildcard] = useState<CardWildcardOptions>(DEFAULT_WILDCARD)
  const [batches, setBatches] = useState<CardBatch[]>([])
  const [usedByRule, setUsedByRule] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [progress, setProgress] = useState<Progress>(null)

  const load = useCallback(async () => {
    if (!workspaceId || !eventId) return
    if (!hasLoadedRef.current) setLoading(true)
    setError(null)
    try {
      await ensureCardConfigDefaults(eventId)
      const [ev, rs, ts, bs, artwork, gameStyle, wildcard] = await Promise.all([
        getEvent(workspaceId, eventId), listRuleSets(workspaceId, eventId), listCardTemplates(workspaceId, eventId), listCardBatches(workspaceId, eventId), getEventCardArtwork(workspaceId,eventId), getEventCardGameStyle(workspaceId,eventId), getEventCardWildcard(workspaceId,eventId),
      ])
      setEvent(ev); setRules(rs.filter(r => r.is_active)); setTemplates(ts.filter(t => t.is_active)); setBatches(bs); setEventArtwork(artwork); setEventGameStyle(gameStyle); setEventWildcard(wildcard)
      const counts = await Promise.all(rs.map(async r => [r.id, await countGameDefinitions(r.id)] as const))
      setUsedByRule(Object.fromEntries(counts))
    } catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível carregar o gerador.') }
    finally { hasLoadedRef.current = true; setLoading(false) }
  }, [workspaceId, eventId])
  useEffect(() => { void load() }, [load])

  if (loading) return <Card>Preparando o motor de geração…</Card>
  if (!event || !currentWorkspace || !eventId) return <Card><p className="text-red-700">{error ?? 'Evento não encontrado.'}</p></Card>

  return <div className="space-y-6">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-sm font-bold text-red-400">Cartelas</p><h1 className="mt-1 text-3xl font-black">Gerar cartelas</h1><p className="mt-2 text-sm text-slate-600">{event.name}. Escolha o visual e a quantidade. As opções técnicas ficam disponíveis somente quando você precisar.</p></div><div className="flex flex-wrap gap-2"><Link to={`/eventos/${eventId}`}><Button variant="secondary">Voltar ao evento</Button></Link></div></div>
    {notice && <div className="rounded-2xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">{notice}</div>}
    {error && <div className="rounded-2xl bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</div>}
    {progress && <Card><div className="flex items-center justify-between gap-3"><div><p className="text-sm font-black">{progress.step}</p><p className="text-xs text-slate-500">{progress.current.toLocaleString('pt-BR')} de {progress.total.toLocaleString('pt-BR')}</p></div><p className="text-lg font-black">{progress.total ? Math.round(progress.current / progress.total * 100) : 0}%</p></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full bg-emerald-600 transition-all" style={{ width: `${progress.total ? progress.current / progress.total * 100 : 0}%` }} /></div></Card>}
    <GenerationForm rules={rules} templates={templates} eventArtwork={eventArtwork} eventGameStyle={eventGameStyle} eventWildcard={eventWildcard} batches={batches} usedByRule={usedByRule} workspaceId={currentWorkspace.id} eventId={eventId} eventName={event.name} initialFormat={searchParams.get('formato')} initialTemplateId={searchParams.get('modelo')} disabled={busy} onBusy={setBusy} onProgress={setProgress} onError={setError} onDone={async message => { setNotice(message); setProgress(null); const [bs,counts]=await Promise.all([listCardBatches(currentWorkspace.id,eventId),Promise.all(rules.map(async r=>[r.id,await countGameDefinitions(r.id)] as const))]);setBatches(bs);setUsedByRule(Object.fromEntries(counts)) }} onArtworkSaved={setEventArtwork} onGameStyleSaved={setEventGameStyle} onWildcardSaved={setEventWildcard} />
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

function GenerationForm({ rules, templates, eventArtwork, eventGameStyle, eventWildcard, batches, usedByRule, workspaceId, eventId, eventName, initialFormat, initialTemplateId, disabled, onBusy, onProgress, onError, onDone, onArtworkSaved, onGameStyleSaved, onWildcardSaved }:{ rules:BingoRuleSet[];templates:CardTemplate[];eventArtwork:CardArtworkOptions|undefined;eventGameStyle:CardGameStyleOptions;eventWildcard:CardWildcardOptions;batches:CardBatch[];usedByRule:Record<string,number>;workspaceId:string;eventId:string;eventName:string;initialFormat:string|null;initialTemplateId:string|null;disabled:boolean;onBusy:(v:boolean)=>void;onProgress:(v:Progress)=>void;onError:(v:string|null)=>void;onDone:(message:string)=>Promise<void>;onArtworkSaved:(artwork:CardArtworkOptions)=>void;onGameStyleSaved:(style:CardGameStyleOptions)=>void;onWildcardSaved:(wildcard:CardWildcardOptions)=>void }) {
  const defaultRule = rules.find(r => r.is_default) ?? rules[0]
  const [ruleId, setRuleId] = useState(defaultRule?.id ?? '')
  const requestedFormat = Number(initialFormat)
  const startingFormat = (requestedFormat===2||requestedFormat===3?requestedFormat:1) as 1|2|3
  const [format, setFormat] = useState<1|2|3>(startingFormat)
  const compatibleTemplates = useMemo(() => templates.filter(t => t.physical_format === format), [templates, format])
  const defaultTemplate = compatibleTemplates.find(t => t.is_default) ?? compatibleTemplates[0]
  const [templateId, setTemplateId] = useState(()=>compatibleTemplates.some(t=>t.id===initialTemplateId)?initialTemplateId??'':defaultTemplate?.id??'')
  const suggestedSeries = useMemo(() => nextAvailableSeries(batches), [batches])
  const [series, setSeries] = useState(() => suggestedSeries)
  const [quantity, setQuantity] = useState(100)
  const [startNumber, setStartNumber] = useState(1)
  const [padding, setPadding] = useState(5)
  const [mode, setMode] = useState<GenerationUniquenessMode>('strict')
  const [showAdvanced, setShowAdvanced] = useState(false)
  const rule = rules.find(r => r.id === ruleId) ?? defaultRule
  const template = compatibleTemplates.find(t => t.id === templateId) ?? defaultTemplate

  useEffect(() => { const t = templates.filter(x => x.physical_format === format); setTemplateId(current => t.some(x => x.id === current) ? current : (t.find(x => x.is_default) ?? t[0])?.id ?? '') }, [format, templates])
  useEffect(() => { if (defaultRule && !ruleId) setRuleId(defaultRule.id) }, [defaultRule, ruleId])
  useEffect(() => {
    const normalized = series.trim().toUpperCase()
    if (!normalized || batches.some(batch => batch.series_code.toUpperCase() === normalized)) setSeries(suggestedSeries)
  }, [batches, series, suggestedSeries])

  const capacity = rule ? uniqueGameCapacity({ totalBalls:rule.total_balls,numbersPerGame:rule.numbers_per_game,distributionMode:rule.distribution_mode,columns:rule.column_definitions }) : 0n
  const used = BigInt(rule ? usedByRule[rule.id] ?? 0 : 0)
  const remaining = capacity > used ? capacity - used : 0n
  const plan = buildGenerationPlan({ requestedCards: quantity, gamesPerCard: format, remainingUniqueGames: remaining, existingUniqueGames: used })
  const needsControlled = !plan.canGenerateStrict

  async function generate() {
    if (!rule || !template) { onError('Selecione uma regra e um layout compatível.'); return }
    const normalizedSeries = series.trim().toUpperCase()
    if (!/^[A-Z0-9][A-Z0-9_-]{0,19}$/.test(normalizedSeries)) { onError('A série deve ter de 1 a 20 caracteres, usando letras, números, _ ou -.'); return }
    if (batches.some(batch => batch.series_code.toUpperCase() === normalizedSeries)) {
      const nextSeries = nextAvailableSeries(batches)
      setSeries(nextSeries)
      onError(`A série ${normalizedSeries} já foi usada neste evento. Ajustei automaticamente para ${nextSeries}. Clique em Gerar cartelas novamente.`)
      return
    }
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
      batchId = await createCardBatch({ workspaceId,eventId,rule,template,artwork:eventArtwork??parseCardTemplateOptions(template.options).artwork,gameStyle:eventGameStyle,wildcard:eventWildcard,seriesCode:normalizedSeries,requestedCards:quantity,startNumber,codePadding:padding,uniquenessMode:mode,capacitySnapshot:{ total_unique_games:capacity.toString(), already_issued_unique_games:used.toString(), remaining_unique_games:remaining.toString(), strict_card_limit:plan.strictCardLimit.toString(), controlled_card_limit:plan.controlledCardLimit?.toString() ?? null }, })
      onProgress({ step:'Salvando cartelas com validação no banco…', current:0, total:quantity })
      await persistGeneratedCards(batchId,cards,100,persisted=>onProgress({ step:'Salvando cartelas com validação no banco…',current:persisted,total:quantity }))
      await finalizeCardBatch(batchId)
      await onDone(`Lote ${normalizedSeries} concluído: ${quantity.toLocaleString('pt-BR')} cartelas e ${(quantity*format).toLocaleString('pt-BR')} jogos.`)
    } catch (e) {
      const message = generationErrorMessage(e)
      if (batchId) { try { await markCardBatchFailed(batchId,message) } catch { /* mantém erro original */ } }
      onError(message)
      onProgress(null)
    } finally { onBusy(false) }
  }

  if (!rule) return <Card><p className="font-semibold">Nenhuma regra ativa. Abra as configurações avançadas de cartelas e ative ou crie uma regra.</p></Card>
  return <Card className="border-red-900/30"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><h2 className="text-xl font-black">Criar cartelas</h2><p className="mt-1 text-sm text-slate-600">Defina o formato, deixe a arte do jeito que quer, confira a cartela e escolha a quantidade. Tudo acontece nesta tela.</p></div><StatusBadge tone={needsControlled?'warning':'success'}>{needsControlled?'Verifique a quantidade':'Pronto para gerar'}</StatusBadge></div>
    <div className="mt-5 space-y-6">
      <section className="rounded-2xl border border-slate-700 bg-slate-950/20 p-4"><div className="flex items-start justify-between gap-3"><div><h3 className="font-black">Formato e modelo</h3><p className="mt-1 text-xs text-slate-500">Escolha como a cartela será montada. Você pode mudar isso a qualquer momento.</p></div></div><div className="mt-4"><p className="text-sm font-black">Jogos por cartela</p><div className="mt-2 grid grid-cols-3 gap-2">{([1,2,3] as const).map(value=><button key={value} type="button" onClick={()=>setFormat(value)} className={`rounded-2xl border px-3 py-4 text-center transition ${format===value?'border-red-500 bg-red-950/25 text-white':'border-slate-700 bg-slate-950/20 text-slate-400 hover:border-slate-500 hover:text-white'}`}><strong className="block text-lg">{value} em 1</strong><span className="mt-1 block text-xs">{value===1?'1 jogo':`${value} jogos`}</span></button>)}</div></div><label className="mt-4 block text-sm font-semibold">Modelo da cartela<Select className="mt-1" value={template?.id ?? ''} onChange={e=>setTemplateId(e.target.value)}>{compatibleTemplates.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</Select>{compatibleTemplates.length===0&&<span className="mt-2 block text-xs text-amber-500">Nenhum modelo ativo para {format} em 1.</span>}</label></section>
      {template&&<ArtworkQuickEditor workspaceId={workspaceId} eventId={eventId} eventName={eventName} rule={rule} template={template} eventArtwork={eventArtwork} eventGameStyle={eventGameStyle} eventWildcard={eventWildcard} format={format} series={series} startNumber={startNumber} padding={padding} onSaved={onArtworkSaved}/>}
      {template&&<WildcardQuickEditor workspaceId={workspaceId} eventId={eventId} eventName={eventName} rule={rule} template={template} eventArtwork={eventArtwork} eventGameStyle={eventGameStyle} eventWildcard={eventWildcard} format={format} series={series} startNumber={startNumber} padding={padding} onSaved={onWildcardSaved}/>}
      {template&&<GameStyleQuickEditor workspaceId={workspaceId} eventId={eventId} eventName={eventName} rule={rule} template={template} eventArtwork={eventArtwork} eventGameStyle={eventGameStyle} eventWildcard={eventWildcard} format={format} series={series} startNumber={startNumber} padding={padding} onSaved={onGameStyleSaved}/>}
      <section className="rounded-2xl border border-slate-700 bg-slate-950/20 p-4"><h3 className="font-black">Quantidade e geração</h3><p className="mt-1 text-xs text-slate-500">Depois de conferir a miniatura acima, informe quantas cartelas deseja gerar.</p><div className="mt-4 max-w-sm"><NumberField label="Quantidade de cartelas" value={quantity} set={setQuantity} min={1} max={10_000}/></div>
      <div className="mt-5 rounded-2xl border border-slate-700 bg-slate-950/20 p-4"><button type="button" onClick={()=>setShowAdvanced(v=>!v)} className="flex w-full items-center justify-between gap-3 text-left"><div><p className="text-sm font-black text-slate-200">Configurações avançadas</p><p className="mt-1 text-xs text-slate-500">Regra, série, numeração e controle de repetição. Normalmente não é necessário alterar.</p></div><span className="text-lg font-black text-slate-400">{showAdvanced?'−':'+'}</span></button>
      {showAdvanced&&<div className="mt-4 border-t border-slate-800 pt-4"><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <label className="text-sm font-semibold">Regra<Select className="mt-1" value={rule.id} onChange={e=>setRuleId(e.target.value)}>{rules.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}</Select></label>
        <label className="text-sm font-semibold">Série do lote<Input className="mt-1" maxLength={20} value={series} onChange={e=>setSeries(e.target.value.toUpperCase())}/><span className="mt-1 block text-xs font-normal text-slate-500">Preenchida automaticamente com a próxima série livre. Altere somente se precisar.</span></label>
        <NumberField label="Primeiro número" value={startNumber} set={setStartNumber} min={1}/>
        <NumberField label="Dígitos do código" value={padding} set={setPadding} min={1} max={12}/>
        <label className="text-sm font-semibold sm:col-span-2">Repetição de jogos<Select className="mt-1" value={mode} onChange={e=>setMode(e.target.value as GenerationUniquenessMode)}><option value="strict">Não repetir jogos</option><option value="controlled">Permitir repetição controlada se faltar combinação inédita</option></Select></label>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4"><Metric label="Combinações possíveis" value={formatBigInt(capacity)}/><Metric label="Já utilizadas" value={formatBigInt(used)}/><Metric label={`Máximo ${format} em 1 sem repetir`} value={formatBigInt(plan.strictCardLimit)}/><Metric label="Repetições neste lote" value={formatBigInt(plan.repeatedGamesRequired)} tone={plan.repeatedGamesRequired>0n?'warning':'normal'}/></div></div>}
      </div>
      {needsControlled && <div className="mt-4 rounded-2xl bg-amber-50 p-4 text-sm text-amber-900"><p className="font-black">A quantidade escolhida ultrapassa o limite disponível sem repetição.</p><p className="mt-1">Reduza a quantidade ou abra Configurações avançadas e selecione repetição controlada. {format>1&&plan.controlledCardLimit!==null&&<>O limite nesse modo é {formatBigInt(plan.controlledCardLimit)} cartelas.</>}</p></div>}
      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><p className="text-xs text-slate-500">Após gerar, o BINGOUP mostra uma cartela real com os números definitivos antes do PDF.</p><Button className="sm:min-w-40" disabled={disabled||!template} onClick={()=>void generate()}>{disabled?'Gerando…':'Gerar cartelas'}</Button></div></section>
    </div>
  </Card>
}

function ArtworkQuickEditor({workspaceId,eventId,eventName,rule,template,eventArtwork,eventGameStyle,eventWildcard,format,series,startNumber,padding,onSaved}:{workspaceId:string;eventId:string;eventName:string;rule:BingoRuleSet|null|undefined;template:CardTemplate;eventArtwork:CardArtworkOptions|undefined;eventGameStyle:CardGameStyleOptions;eventWildcard:CardWildcardOptions;format:1|2|3;series:string;startNumber:number;padding:number;onSaved:(artwork:CardArtworkOptions)=>void}){
  const legacyArtwork=parseCardTemplateOptions(template.options).artwork
  const initialArtwork=eventArtwork??legacyArtwork
  const templateOptions=parseCardTemplateOptions(template.options)
  const [open,setOpen]=useState(false)
  const [artFile,setArtFile]=useState<File|null>(null)
  const [artUrl,setArtUrl]=useState<string|null>(null)
  const [fit,setFit]=useState<ArtworkFit>(initialArtwork?.fit??'cover')
  const [zoom,setZoom]=useState(initialArtwork?.zoom??1)
  const [offsetX,setOffsetX]=useState(initialArtwork?.offsetX??0)
  const [offsetY,setOffsetY]=useState(initialArtwork?.offsetY??0)
  const [quality,setQuality]=useState<ArtworkQuality>(initialArtwork?.quality??'standard')
  const [saving,setSaving]=useState(false)
  const [message,setMessage]=useState<string|null>(null)
  const existingUrl=getCardAssetUrl(initialArtwork?.path)
  const previewArtwork:CardArtworkOptions|undefined=(artUrl||initialArtwork?.path)?{path:initialArtwork?.path??'local-preview',fit,zoom,offsetX,offsetY,quality}:undefined
  const options:CardTemplateOptions={...templateOptions,artwork:previewArtwork,gameStyle:eventGameStyle,wildcard:eventWildcard}
  useEffect(()=>{if(!eventArtwork)return;setFit(eventArtwork.fit??'cover');setZoom(eventArtwork.zoom??1);setOffsetX(eventArtwork.offsetX??0);setOffsetY(eventArtwork.offsetY??0);setQuality(eventArtwork.quality??'standard');setArtFile(null);setArtUrl(current=>{if(current)URL.revokeObjectURL(current);return null})/* preserve o arquivo local ao trocar somente o modelo */},[eventArtwork])
  useEffect(()=>()=>{if(artUrl)URL.revokeObjectURL(artUrl)},[artUrl])
  function choose(file:File|null){setArtFile(file);setMessage(null);setArtUrl(current=>{if(current)URL.revokeObjectURL(current);return file?URL.createObjectURL(file):null})}
  async function save(){setSaving(true);setMessage(null);try{const artworkFile=artFile?await optimizeArtwork(artFile,quality):undefined;const artwork=await saveEventCardArtwork(workspaceId,eventId,{artwork:{path:initialArtwork?.path,fit,zoom,offsetX,offsetY,quality},artworkFile,fallbackPath:legacyArtwork?.path});onSaved(artwork);setMessage('Imagem salva para este evento. A mesma arte será usada em qualquer modelo e nas cartelas geradas.');setArtFile(null);if(artUrl){URL.revokeObjectURL(artUrl);setArtUrl(null)};setOpen(false)}catch(e){setMessage(e instanceof Error?e.message:'Não foi possível salvar a imagem de fundo.')}finally{setSaving(false)}}
  return <section className="rounded-2xl border border-red-900/40 bg-red-950/10 p-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h3 className="font-black">Imagem de fundo da cartela</h3><p className="mt-1 text-xs text-slate-400">Uma única imagem por evento. Ela vale para 1 em 1, 2 em 1 e 3 em 1.</p></div><Button onClick={()=>setOpen(v=>!v)}>{initialArtwork?.path?'Ajustar imagem de fundo':'Adicionar imagem de fundo'}</Button></div>
  {!open&&<div className="mt-4"><CardTemplatePreview format={format} layoutKey={template.layout_key} eventName={eventName} seriesCode={series.trim().toUpperCase()||'A'} sequenceNumber={startNumber} codePadding={padding} rule={rule} previewOptions={{...templateOptions,artwork:initialArtwork,gameStyle:eventGameStyle,wildcard:eventWildcard}}/><p className="mt-2 text-center text-xs text-slate-500">Visualização antes de gerar. A mesma imagem continuará ao trocar de modelo.</p></div>}
  {open&&<div className="mt-4 grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(320px,.9fr)]"><div className="space-y-4"><div><p className="text-sm font-semibold">Escolher imagem</p><label className="mt-2 inline-flex min-h-12 w-full cursor-pointer items-center justify-center rounded-2xl bg-red-600 px-4 py-3 text-base font-black text-white transition hover:bg-red-500 focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-red-400 sm:w-auto"><input className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>choose(e.target.files?.[0]??null)}/>Buscar imagem no aparelho</label><p className="mt-2 text-xs text-slate-400">{artFile?`Selecionada: ${artFile.name}`:(initialArtwork?.path?'A imagem atual já está salva para todo o evento. Escolha outra somente se quiser substituir.':'Nenhuma imagem selecionada.')}</p></div><div className="grid gap-3 sm:grid-cols-2"><label className="text-sm font-semibold">Encaixe<Select className="mt-1" value={fit} onChange={e=>{setFit(e.target.value as ArtworkFit);setZoom(1);setOffsetX(0);setOffsetY(0)}}><option value="cover">Preencher toda a cartela</option><option value="contain">Mostrar a imagem inteira</option></Select></label><label className="text-sm font-semibold">Qualidade<Select className="mt-1" value={quality} onChange={e=>setQuality(e.target.value as ArtworkQuality)}><option value="light">Arquivo leve</option><option value="standard">Impressão padrão</option><option value="high">Alta qualidade</option></Select></label></div><div className="grid gap-3 sm:grid-cols-3"><QuickRange label={`Tamanho ${zoom.toFixed(2)}×`} min={.5} max={3} step={.05} value={zoom} set={setZoom}/><QuickRange label={`Horizontal ${offsetX}%`} min={-60} max={60} step={1} value={offsetX} set={setOffsetX}/><QuickRange label={`Vertical ${offsetY}%`} min={-60} max={60} step={1} value={offsetY} set={setOffsetY}/></div><div className="flex flex-wrap gap-2"><Button variant="secondary" onClick={()=>{setFit('cover');setZoom(1);setOffsetX(0);setOffsetY(0)}}>Centralizar</Button><Button disabled={saving||(!artFile&&!initialArtwork?.path)} onClick={()=>void save()}>{saving?'Salvando…':'Salvar imagem e ajuste'}</Button><Button variant="secondary" onClick={()=>setOpen(false)}>Cancelar</Button></div>{message&&<p className="rounded-xl bg-slate-950/30 p-3 text-xs font-semibold text-slate-300">{message}</p>}</div><div><p className="mb-2 text-xs font-black uppercase tracking-[.14em] text-red-400">Visualização ao vivo</p><CardTemplatePreview format={format} layoutKey={template.layout_key} eventName={eventName} seriesCode={series.trim().toUpperCase()||'A'} sequenceNumber={startNumber} codePadding={padding} rule={rule} previewOptions={options} localArtworkUrl={artUrl??existingUrl}/><p className="mt-2 text-xs text-slate-500">Ajuste uma vez. A arte continuará disponível em todos os modelos deste evento.</p></div></div>}</section>
}


const WILDCARD_CHOICES:Array<{kind:Exclude<WildcardKind,'custom'|'none'>;label:string}>=[
  {kind:'star',label:'Estrela'},{kind:'circle',label:'Bola'},{kind:'heart',label:'Coração'},{kind:'cross',label:'Cruz'},
  {kind:'fire',label:'Fogueira'},{kind:'soccer',label:'Futebol'},{kind:'diamond',label:'Diamante'},{kind:'square',label:'Quadrado'},
  {kind:'triangle',label:'Triângulo'},{kind:'sun',label:'Sol'},{kind:'moon',label:'Lua'},{kind:'clover',label:'Trevo'},
  {kind:'flower',label:'Flor'},{kind:'bolt',label:'Raio'},{kind:'check',label:'Certo'},{kind:'xmark',label:'X'},
  {kind:'crown',label:'Coroa'},{kind:'target',label:'Alvo'},{kind:'ring',label:'Anel'},{kind:'sparkle',label:'Brilho'},
]

function WildcardQuickEditor({workspaceId,eventId,eventName,rule,template,eventArtwork,eventGameStyle,eventWildcard,format,series,startNumber,padding,onSaved}:{workspaceId:string;eventId:string;eventName:string;rule:BingoRuleSet|null|undefined;template:CardTemplate;eventArtwork:CardArtworkOptions|undefined;eventGameStyle:CardGameStyleOptions;eventWildcard:CardWildcardOptions;format:1|2|3;series:string;startNumber:number;padding:number;onSaved:(wildcard:CardWildcardOptions)=>void}){
  const [open,setOpen]=useState(false)
  const [wildcard,setWildcard]=useState<CardWildcardOptions>(eventWildcard)
  const [file,setFile]=useState<File|null>(null)
  const [localUrl,setLocalUrl]=useState<string|null>(null)
  const [saving,setSaving]=useState(false)
  const [message,setMessage]=useState<string|null>(null)
  useEffect(()=>{setWildcard(eventWildcard);setFile(null);setLocalUrl(current=>{if(current)URL.revokeObjectURL(current);return null})},[eventWildcard])
  useEffect(()=>()=>{if(localUrl)URL.revokeObjectURL(localUrl)},[localUrl])
  function chooseCustom(fileValue:File|null){
    setMessage(null)
    if(fileValue&&fileValue.type!=='image/png'){setMessage('O coringa personalizado precisa ser um arquivo PNG.');return}
    setFile(fileValue);setWildcard(current=>({...current,kind:'custom'}));setLocalUrl(current=>{if(current)URL.revokeObjectURL(current);return fileValue?URL.createObjectURL(fileValue):null})
  }
  function selectKind(kind:WildcardKind){setWildcard(current=>({...current,kind,path:kind==='custom'?current.path:undefined}));if(kind!=='custom'){setFile(null);setLocalUrl(current=>{if(current)URL.revokeObjectURL(current);return null})}}
  async function save(){
    setSaving(true);setMessage(null)
    try{
      const optimized=file?await optimizeWildcard(file):undefined
      const saved=await saveEventCardWildcard(workspaceId,eventId,{wildcard,wildcardFile:optimized})
      setWildcard(saved);onSaved(saved);setFile(null);setLocalUrl(current=>{if(current)URL.revokeObjectURL(current);return null});setMessage('Coringa salvo para este evento e para as próximas cartelas geradas.');setOpen(false)
    }catch(e){setMessage(e instanceof Error?e.message:'Não foi possível salvar o coringa.')}finally{setSaving(false)}
  }
  const previewOptions:CardTemplateOptions={...parseCardTemplateOptions(template.options),artwork:eventArtwork??parseCardTemplateOptions(template.options).artwork,gameStyle:eventGameStyle,wildcard}
  const existingCustomUrl=wildcard.kind==='custom'&&!localUrl?getCardAssetUrl(wildcard.path):null
  return <section className="rounded-2xl border border-slate-700 bg-slate-950/20 p-4">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h3 className="font-black">Coringa do jogo</h3><p className="mt-1 text-xs text-slate-500">Escolha a casa livre central. Há 20 opções prontas ou você pode importar seu próprio ícone PNG.</p></div><Button variant="secondary" onClick={()=>setOpen(v=>!v)}>{open?'Fechar coringa':'Mudar coringa'}</Button></div>
    {!open&&<div className="mt-4 flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-950/30 p-3"><div className="grid h-12 w-12 place-items-center rounded-xl bg-white text-3xl text-red-600">{eventWildcard.kind==='custom'&&getCardAssetUrl(eventWildcard.path)?<img src={getCardAssetUrl(eventWildcard.path)??''} className="max-h-10 max-w-10 object-contain" alt="Coringa"/>:<WildcardSymbol config={eventWildcard}/>}</div><div><p className="text-sm font-bold text-slate-200">{wildcardName(eventWildcard.kind)}</p><p className="text-xs text-slate-500">Este símbolo será salvo junto com cada lote gerado.</p></div></div>}
    {open&&<div className="mt-4 grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(320px,.9fr)]"><div className="space-y-4">
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">{WILDCARD_CHOICES.map(item=><button key={item.kind} type="button" onClick={()=>selectKind(item.kind)} className={`rounded-xl border p-2 text-center transition ${wildcard.kind===item.kind?'border-red-500 bg-red-950/30':'border-slate-700 hover:border-slate-500'}`}><span className="mx-auto grid h-9 place-items-center text-2xl text-red-500"><WildcardSymbol config={{kind:item.kind,scale:1}}/></span><span className="mt-1 block truncate text-[11px] font-semibold text-slate-300">{item.label}</span></button>)}</div>
      <div className="grid gap-3 sm:grid-cols-2"><button type="button" onClick={()=>selectKind('none')} className={`rounded-xl border p-3 text-sm font-bold ${wildcard.kind==='none'?'border-red-500 bg-red-950/30':'border-slate-700'}`}>Sem coringa</button><label className={`cursor-pointer rounded-xl border p-3 text-center text-sm font-bold ${wildcard.kind==='custom'?'border-red-500 bg-red-950/30':'border-slate-700'}`}><input type="file" className="sr-only" accept="image/png" onChange={e=>chooseCustom(e.target.files?.[0]??null)}/>Importar PNG personalizado</label></div>
      {wildcard.kind==='custom'&&<p className="text-xs text-slate-400">{file?`Selecionado: ${file.name}`:wildcard.path?'O PNG personalizado atual será mantido até você escolher outro.':'Escolha um arquivo PNG com fundo transparente para melhor resultado.'}</p>}
      <QuickRange label={`Tamanho do coringa ${wildcard.scale.toFixed(2)}×`} min={.4} max={1.6} step={.05} value={wildcard.scale} set={value=>setWildcard(current=>({...current,scale:value}))}/>
      <div className="flex flex-wrap gap-2"><Button variant="secondary" onClick={()=>{setWildcard(DEFAULT_WILDCARD);setFile(null);setLocalUrl(null)}}>Restaurar estrela</Button><Button disabled={saving||(wildcard.kind==='custom'&&!file&&!wildcard.path)} onClick={()=>void save()}>{saving?'Salvando…':'Salvar coringa'}</Button></div>
      {message&&<p className="rounded-xl bg-slate-950/30 p-3 text-xs font-semibold text-slate-300">{message}</p>}
    </div><div><p className="mb-2 text-xs font-black uppercase tracking-[.14em] text-red-400">Visualização ao vivo</p><CardTemplatePreview format={format} layoutKey={template.layout_key} eventName={eventName} seriesCode={series.trim().toUpperCase()||'A'} sequenceNumber={startNumber} codePadding={padding} rule={rule} previewOptions={previewOptions} localWildcardUrl={localUrl??existingCustomUrl}/><p className="mt-2 text-xs text-slate-500">O coringa escolhido vale para 1 em 1, 2 em 1 e 3 em 1 neste evento.</p></div></div>}
  </section>
}

function wildcardName(kind:WildcardKind){return kind==='custom'?'Personalizado':kind==='none'?'Sem coringa':WILDCARD_CHOICES.find(item=>item.kind===kind)?.label??'Coringa'}

function GameStyleQuickEditor({workspaceId,eventId,eventName,rule,template,eventArtwork,eventGameStyle,eventWildcard,format,series,startNumber,padding,onSaved}:{workspaceId:string;eventId:string;eventName:string;rule:BingoRuleSet|null|undefined;template:CardTemplate;eventArtwork:CardArtworkOptions|undefined;eventGameStyle:CardGameStyleOptions;eventWildcard:CardWildcardOptions;format:1|2|3;series:string;startNumber:number;padding:number;onSaved:(style:CardGameStyleOptions)=>void}){
  const [open,setOpen]=useState(false)
  const [style,setStyle]=useState<CardGameStyleOptions>(eventGameStyle)
  const [saving,setSaving]=useState(false)
  const [message,setMessage]=useState<string|null>(null)
  useEffect(()=>setStyle(eventGameStyle),[eventGameStyle])
  const update=<K extends keyof CardGameStyleOptions,>(key:K,value:CardGameStyleOptions[K])=>setStyle(current=>({...current,[key]:value}))
  async function save(){setSaving(true);setMessage(null);try{const saved=await saveEventCardGameStyle(workspaceId,eventId,style);setStyle(saved);onSaved(saved);setMessage('Aparência dos números salva para as próximas cartelas deste evento.')}catch(e){setMessage(e instanceof Error?e.message:'Não foi possível salvar a aparência.')}finally{setSaving(false)}}
  const options:CardTemplateOptions={...parseCardTemplateOptions(template.options),artwork:eventArtwork??parseCardTemplateOptions(template.options).artwork,gameStyle:style,wildcard:eventWildcard}
  return <section className="rounded-2xl border border-slate-700 bg-slate-950/20 p-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h3 className="font-black">Conjunto de números</h3><p className="mt-1 text-xs text-slate-500">Personalize grade, cores, fontes, proporção e espaçamentos. A prévia e o PDF usam a mesma configuração.</p></div><Button variant="secondary" onClick={()=>setOpen(v=>!v)}>{open?'Fechar ajustes':'Personalizar números e grade'}</Button></div>
  {!open&&<div className="mt-4"><CardTemplatePreview format={format} layoutKey={template.layout_key} eventName={eventName} seriesCode={series.trim().toUpperCase()||'A'} sequenceNumber={startNumber} codePadding={padding} rule={rule} previewOptions={options}/></div>}
  {open&&<div className="mt-4 grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(320px,.9fr)]"><div className="space-y-5">
    <div><p className="text-sm font-black text-slate-200">Cores</p><div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3"><ColorField label="Números" value={style.numberColor} set={v=>update('numberColor',v)}/><ColorField label="Linhas da grade" value={style.gridColor} set={v=>update('gridColor',v)}/><ColorField label="Cor do fundo dos números" value={style.cellBackground} set={v=>update('cellBackground',v)}/><ColorField label="Barra BINGO" value={style.headerBackground} set={v=>update('headerBackground',v)}/><ColorField label="Letras BINGO" value={style.headerTextColor} set={v=>update('headerTextColor',v)}/></div><div className="mt-4"><p className="text-xs font-bold text-slate-300">Transparência do fundo dos números</p><div className="mt-2 grid gap-2 sm:grid-cols-3"><OpacityButton label="Sólido" value={1} current={style.cellBackgroundOpacity} set={v=>update('cellBackgroundOpacity',v)}/><OpacityButton label="Levemente transparente" value={.55} current={style.cellBackgroundOpacity} set={v=>update('cellBackgroundOpacity',v)}/><OpacityButton label="Transparente" value={0} current={style.cellBackgroundOpacity} set={v=>update('cellBackgroundOpacity',v)}/></div><div className="mt-3"><QuickRange label={`Opacidade ${Math.round(style.cellBackgroundOpacity*100)}%`} min={0} max={1} step={.05} value={style.cellBackgroundOpacity} set={v=>update('cellBackgroundOpacity',v)}/></div><p className="mt-2 text-xs text-slate-500">Com transparência, a arte de fundo aparece por trás dos números. As linhas da grade e os números continuam visíveis.</p></div></div>
    <div><p className="text-sm font-black text-slate-200">Fontes</p><div className="mt-3 grid gap-3 sm:grid-cols-2"><FontField label="Fonte dos números" value={style.numberFont} set={v=>update('numberFont',v)}/><FontField label="Fonte do BINGO" value={style.headerFont} set={v=>update('headerFont',v)}/><label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={style.numberBold} onChange={e=>update('numberBold',e.target.checked)}/>Números em negrito</label><label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={style.headerBold} onChange={e=>update('headerBold',e.target.checked)}/>BINGO em negrito</label></div><div className="mt-3 grid gap-3 sm:grid-cols-2"><QuickRange label={`Tamanho dos números ${Math.round(style.numberScale*100)}%`} min={.65} max={1.5} step={.05} value={style.numberScale} set={v=>update('numberScale',v)}/><QuickRange label={`Tamanho do BINGO ${Math.round(style.headerScale*100)}%`} min={.65} max={1.5} step={.05} value={style.headerScale} set={v=>update('headerScale',v)}/></div></div>
    <div><p className="text-sm font-black text-slate-200">Formato da caixa</p><div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3"><QuickRange label={`Largura ${Math.round(style.widthScale*100)}%`} min={.65} max={1} step={.01} value={style.widthScale} set={v=>update('widthScale',v)}/><QuickRange label={`Altura ${Math.round(style.heightScale*100)}%`} min={.65} max={1} step={.01} value={style.heightScale} set={v=>update('heightScale',v)}/><QuickRange label={`Cantos ${Math.round(style.cornerRadius)} px`} min={0} max={24} step={1} value={style.cornerRadius} set={v=>update('cornerRadius',v)}/></div></div>
    <div><p className="text-sm font-black text-slate-200">Espaçamentos e grade</p><div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3"><QuickRange label={`Espaço entre células ${style.cellGap.toFixed(1)}`} min={0} max={6} step={.5} value={style.cellGap} set={v=>update('cellGap',v)}/><QuickRange label={`Espessura da grade ${style.gridLineWidth.toFixed(2)}`} min={.25} max={3} step={.25} value={style.gridLineWidth} set={v=>update('gridLineWidth',v)}/><QuickRange label={`Altura da barra BINGO ${Math.round(style.headerHeight)}%`} min={8} max={24} step={1} value={style.headerHeight} set={v=>update('headerHeight',v)}/></div></div>
    <div className="flex flex-wrap gap-2"><Button variant="secondary" onClick={()=>setStyle(DEFAULT_GAME_STYLE)}>Restaurar padrão</Button><Button disabled={saving} onClick={()=>void save()}>{saving?'Salvando…':'Salvar aparência dos números'}</Button></div>{message&&<p className="rounded-xl bg-slate-950/30 p-3 text-xs font-semibold text-slate-300">{message}</p>}
  </div><div><p className="mb-2 text-xs font-black uppercase tracking-[.14em] text-red-400">Visualização ao vivo</p><CardTemplatePreview format={format} layoutKey={template.layout_key} eventName={eventName} seriesCode={series.trim().toUpperCase()||'A'} sequenceNumber={startNumber} codePadding={padding} rule={rule} previewOptions={options}/><p className="mt-2 text-xs text-slate-500">A configuração é compartilhada entre 1 em 1, 2 em 1 e 3 em 1. Cada novo lote salva uma cópia da aparência usada.</p></div></div>}
  </section>
}

function ColorField({label,value,set}:{label:string;value:string;set:(value:string)=>void}){return <label className="text-sm font-semibold">{label}<span className="mt-1 flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-950/30 p-2"><input type="color" value={value} onChange={e=>set(e.target.value)} className="h-9 w-12 cursor-pointer rounded border-0 bg-transparent p-0"/><span className="font-mono text-xs text-slate-400">{value.toUpperCase()}</span></span></label>}
function FontField({label,value,set}:{label:string;value:CardGameFont;set:(value:CardGameFont)=>void}){return <label className="text-sm font-semibold">{label}<Select className="mt-1" value={value} onChange={e=>set(e.target.value as CardGameFont)}><option value="helvetica">Arial / Helvetica</option><option value="times">Times</option><option value="courier">Courier</option></Select></label>}

function OpacityButton({label,value,current,set}:{label:string;value:number;current:number;set:(value:number)=>void}){const active=Math.abs(current-value)<.03;return <button type="button" onClick={()=>set(value)} className={`rounded-xl border px-3 py-2 text-xs font-bold transition ${active?'border-red-500 bg-red-950/30 text-white':'border-slate-700 text-slate-300 hover:border-slate-500'}`}>{label}</button>}

function QuickRange({label,min,max,step,value,set}:{label:string;min:number;max:number;step:number;value:number;set:(v:number)=>void}){return <label className="block text-xs font-semibold text-slate-400">{label}<input className="mt-2 w-full accent-red-600" type="range" min={min} max={max} step={step} value={value} onChange={e=>set(Number(e.target.value))}/></label>}

function BatchList({ workspaceId,event,eventId,batches,busy,onCancel,onDelete }:{workspaceId:string;event:EventWithSettings;eventId:string;batches:CardBatch[];busy:boolean;onCancel:(batch:CardBatch)=>Promise<void>;onDelete:(batch:CardBatch)=>Promise<void>}) {
  const completed=batches.filter(batch=>batch.status==='completed')
  return <div className="space-y-3"><div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><h2 className="text-xl font-black">Cartelas geradas</h2><p className="text-sm text-slate-600">Antes do PDF, abra a miniatura real e confira os números, a imagem de fundo, o encaixe e o coringa. Se o lote foi só um teste ou saiu errado, você pode excluí-lo enquanto nenhuma cartela tiver sido usada.</p></div>{completed.length>0&&<Link to={`/eventos/${eventId}/cartelas`}><Button variant="secondary">Ver todas as cartelas</Button></Link>}</div>{batches.length===0?<Card><p className="text-sm text-slate-500">Nenhum lote gerado ainda.</p></Card>:<div className="grid gap-4 xl:grid-cols-2">{batches.map(batch=><Card key={batch.id}><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wide text-slate-500">Série {batch.series_code}</p><h3 className="mt-1 text-lg font-black">{batch.requested_cards.toLocaleString('pt-BR')} cartelas · {batch.physical_format} em 1</h3></div><StatusBadge tone={batch.status==='completed'?'success':batch.status==='failed'?'danger':batch.status==='canceled'?'warning':'neutral'}>{batchStatus[batch.status]}</StatusBadge></div><div className="mt-4 grid grid-cols-2 gap-3 text-sm"><Mini label="Cartelas gravadas" value={`${batch.generated_cards.toLocaleString('pt-BR')} / ${batch.requested_cards.toLocaleString('pt-BR')}`}/><Mini label="Jogos internos" value={batch.generated_games.toLocaleString('pt-BR')}/><Mini label="Jogos inéditos" value={batch.unique_games_created.toLocaleString('pt-BR')}/><Mini label="Reaproveitados" value={batch.reused_games.toLocaleString('pt-BR')}/></div>{batch.error_message&&<p className="mt-3 rounded-xl bg-red-50 p-3 text-xs text-red-700">{batch.error_message}</p>}{batch.status==='completed'&&<><RealBatchPreview workspaceId={workspaceId} event={event} eventId={eventId} batch={batch}/><div className="mt-4 rounded-xl bg-emerald-50 p-3 text-xs font-semibold text-emerald-900">Confira a miniatura acima. Quando estiver correta, siga para o PDF.</div><div className="mt-3 grid gap-2 sm:grid-cols-2"><Link to={`/eventos/${eventId}/cartelas?lote=${batch.id}`}><Button variant="secondary" className="w-full">Ver todas as cartelas</Button></Link><Link to={`/eventos/${eventId}/cartelas/lote/${batch.id}/imprimir`}><Button className="w-full">Gerar PDF</Button></Link></div></>}{['generating','failed'].includes(batch.status)&&<div className="mt-4"><Button variant="secondary" disabled={busy} onClick={()=>void onCancel(batch)}>Cancelar e limpar lote</Button></div>}{batch.status!=='generating'&&<div className="mt-2 flex justify-end"><button type="button" disabled={busy} onClick={()=>void onDelete(batch)} className="rounded-lg px-3 py-2 text-xs font-bold text-red-400 transition hover:bg-red-950/35 hover:text-red-300 disabled:opacity-50">Excluir lote de teste</button></div>}</Card>)}</div>}</div>
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
      <div><p className="text-sm font-black text-slate-100">Miniatura real antes do PDF</p><p className="text-xs text-slate-400">Esta é uma cartela verdadeira do lote, com números, imagem de fundo, posição e coringa já salvos.</p></div>
      <Button variant="secondary" onClick={()=>setExpanded(true)}>Visualizar miniatura real</Button>
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

function seriesFromIndex(index:number){
  let value=Math.max(0,Math.trunc(index))+1
  let result=''
  while(value>0){
    value-=1
    result=String.fromCharCode(65+(value%26))+result
    value=Math.floor(value/26)
  }
  return result
}

function nextAvailableSeries(batches:CardBatch[]){
  const used=new Set(batches.map(batch=>batch.series_code.trim().toUpperCase()))
  for(let index=0;index<10000;index+=1){
    const candidate=seriesFromIndex(index)
    if(!used.has(candidate))return candidate
  }
  return `L${Date.now().toString(36).toUpperCase()}`.slice(0,20)
}

function generationErrorMessage(error:unknown){
  if(error instanceof Error&&error.message)return error.message
  if(error&&typeof error==='object'){
    const value=error as {message?:unknown;details?:unknown;hint?:unknown;code?:unknown}
    const message=typeof value.message==='string'?value.message.trim():''
    const details=typeof value.details==='string'?value.details.trim():''
    const hint=typeof value.hint==='string'?value.hint.trim():''
    const code=typeof value.code==='string'?value.code.trim():''
    const combined=[message,details,hint].filter(Boolean).join(' ')
    if(code==='23505'&&combined.toLowerCase().includes('series'))return 'Esta série de lote já existe neste evento. O sistema escolherá automaticamente a próxima série livre.'
    if(code==='23505'&&combined.toLowerCase().includes('code'))return 'A numeração desta série já existe neste evento. Use a próxima série automática ou altere o primeiro número.'
    if(combined)return combined
  }
  return 'Falha durante a geração. O servidor não retornou uma mensagem detalhada.'
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
