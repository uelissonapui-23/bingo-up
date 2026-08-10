import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useWorkspace } from '@/app/providers/WorkspaceProvider'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { CardTemplatePreview } from '@/components/cards/CardTemplatePreview'
import { PrintableCard } from '@/components/cards/PrintableCard'
import { getEvent } from '@/features/events/eventService'
import { ensureCardConfigDefaults, getCardAssetUrl, getEventCardArtwork, listCardTemplates, listRuleSets, saveEventCardArtwork } from '@/features/card-config/cardConfigService'
import { buildGenerationPlan, composePhysicalCards, createUniqueGames } from '@/domain/cards/generator'
import { formatBigInt, uniqueGameCapacity } from '@/domain/cards/capacity'
import { optimizeArtwork } from '@/domain/cards/artwork'
import { parseCardTemplateOptions, type ArtworkFit, type ArtworkQuality, type CardArtworkOptions, type CardTemplateOptions } from '@/domain/cards/templateOptions'
import type { BingoRuleSet, CardBatch, CardTemplate, EventWithSettings, GenerationUniquenessMode } from '@/types/database'
import { cancelCardBatch, countGameDefinitions, createCardBatch, finalizeCardBatch, listCardBatches, loadExistingCompositionSignatures, loadExistingGameDefinitions, markCardBatchFailed, persistGeneratedCards, deleteUnusedCardBatch } from './cardGenerationService'
import { listBatchCardsForPrint, type PhysicalCardView } from '@/features/cards/cardService'
type Progress = { step: string; current: number; total: number } | null

export function CardGeneratorPage() {
  const { eventId } = useParams()
  const [searchParams] = useSearchParams()
  const { currentWorkspace } = useWorkspace()
  const [event, setEvent] = useState<EventWithSettings | null>(null)
  const [rules, setRules] = useState<BingoRuleSet[]>([])
  const [templates, setTemplates] = useState<CardTemplate[]>([])
  const [eventArtwork, setEventArtwork] = useState<CardArtworkOptions | undefined>(undefined)
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
      const [ev, rs, ts, bs, artwork] = await Promise.all([
        getEvent(currentWorkspace.id, eventId), listRuleSets(currentWorkspace.id, eventId), listCardTemplates(currentWorkspace.id, eventId), listCardBatches(currentWorkspace.id, eventId), getEventCardArtwork(currentWorkspace.id,eventId),
      ])
      setEvent(ev); setRules(rs.filter(r => r.is_active)); setTemplates(ts.filter(t => t.is_active)); setBatches(bs); setEventArtwork(artwork)
      const counts = await Promise.all(rs.map(async r => [r.id, await countGameDefinitions(r.id)] as const))
      setUsedByRule(Object.fromEntries(counts))
    } catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível carregar o gerador.') }
    finally { setLoading(false) }
  }, [currentWorkspace, eventId])
  useEffect(() => { void load() }, [load])

  if (loading) return <Card>Preparando o motor de geração…</Card>
  if (!event || !currentWorkspace || !eventId) return <Card><p className="text-red-700">{error ?? 'Evento não encontrado.'}</p></Card>

  return <div className="space-y-6">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-sm font-bold text-red-400">Cartelas</p><h1 className="mt-1 text-3xl font-black">Gerar cartelas</h1><p className="mt-2 text-sm text-slate-600">{event.name}. Escolha o visual e a quantidade. As opções técnicas ficam disponíveis somente quando você precisar.</p></div><div className="flex flex-wrap gap-2"><Link to={`/eventos/${eventId}`}><Button variant="secondary">Voltar ao evento</Button></Link></div></div>
    {notice && <div className="rounded-2xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">{notice}</div>}
    {error && <div className="rounded-2xl bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</div>}
    {progress && <Card><div className="flex items-center justify-between gap-3"><div><p className="text-sm font-black">{progress.step}</p><p className="text-xs text-slate-500">{progress.current.toLocaleString('pt-BR')} de {progress.total.toLocaleString('pt-BR')}</p></div><p className="text-lg font-black">{progress.total ? Math.round(progress.current / progress.total * 100) : 0}%</p></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full bg-emerald-600 transition-all" style={{ width: `${progress.total ? progress.current / progress.total * 100 : 0}%` }} /></div></Card>}
    <GenerationForm rules={rules} templates={templates} eventArtwork={eventArtwork} batches={batches} usedByRule={usedByRule} workspaceId={currentWorkspace.id} eventId={eventId} eventName={event.name} initialFormat={searchParams.get('formato')} initialTemplateId={searchParams.get('modelo')} disabled={busy} onBusy={setBusy} onProgress={setProgress} onError={setError} onDone={async message => { setNotice(message); setProgress(null); const [bs,counts]=await Promise.all([listCardBatches(currentWorkspace.id,eventId),Promise.all(rules.map(async r=>[r.id,await countGameDefinitions(r.id)] as const))]);setBatches(bs);setUsedByRule(Object.fromEntries(counts)) }} onArtworkSaved={setEventArtwork} />
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

function GenerationForm({ rules, templates, eventArtwork, batches, usedByRule, workspaceId, eventId, eventName, initialFormat, initialTemplateId, disabled, onBusy, onProgress, onError, onDone, onArtworkSaved }:{ rules:BingoRuleSet[];templates:CardTemplate[];eventArtwork:CardArtworkOptions|undefined;batches:CardBatch[];usedByRule:Record<string,number>;workspaceId:string;eventId:string;eventName:string;initialFormat:string|null;initialTemplateId:string|null;disabled:boolean;onBusy:(v:boolean)=>void;onProgress:(v:Progress)=>void;onError:(v:string|null)=>void;onDone:(message:string)=>Promise<void>;onArtworkSaved:(artwork:CardArtworkOptions)=>void }) {
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
      batchId = await createCardBatch({ workspaceId,eventId,rule,template,artwork:eventArtwork??parseCardTemplateOptions(template.options).artwork,seriesCode:normalizedSeries,requestedCards:quantity,startNumber,codePadding:padding,uniquenessMode:mode,capacitySnapshot:{ total_unique_games:capacity.toString(), already_issued_unique_games:used.toString(), remaining_unique_games:remaining.toString(), strict_card_limit:plan.strictCardLimit.toString(), controlled_card_limit:plan.controlledCardLimit?.toString() ?? null }, })
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
      {template&&<ArtworkQuickEditor workspaceId={workspaceId} eventId={eventId} eventName={eventName} rule={rule} template={template} eventArtwork={eventArtwork} format={format} series={series} startNumber={startNumber} padding={padding} onSaved={onArtworkSaved}/>}
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

function ArtworkQuickEditor({workspaceId,eventId,eventName,rule,template,eventArtwork,format,series,startNumber,padding,onSaved}:{workspaceId:string;eventId:string;eventName:string;rule:BingoRuleSet|null|undefined;template:CardTemplate;eventArtwork:CardArtworkOptions|undefined;format:1|2|3;series:string;startNumber:number;padding:number;onSaved:(artwork:CardArtworkOptions)=>void}){
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
  const options:CardTemplateOptions={...templateOptions,artwork:previewArtwork}
  useEffect(()=>{const next=eventArtwork??parseCardTemplateOptions(template.options).artwork;setFit(next?.fit??'cover');setZoom(next?.zoom??1);setOffsetX(next?.offsetX??0);setOffsetY(next?.offsetY??0);setQuality(next?.quality??'standard');setArtFile(null);setArtUrl(current=>{if(current)URL.revokeObjectURL(current);return null})},[eventArtwork,template])
  useEffect(()=>()=>{if(artUrl)URL.revokeObjectURL(artUrl)},[artUrl])
  function choose(file:File|null){setArtFile(file);setMessage(null);setArtUrl(current=>{if(current)URL.revokeObjectURL(current);return file?URL.createObjectURL(file):null})}
  async function save(){setSaving(true);setMessage(null);try{const artworkFile=artFile?await optimizeArtwork(artFile,quality):undefined;const artwork=await saveEventCardArtwork(workspaceId,eventId,{artwork:{path:initialArtwork?.path,fit,zoom,offsetX,offsetY,quality},artworkFile,fallbackPath:legacyArtwork?.path});onSaved(artwork);setMessage('Imagem salva para este evento. A mesma arte será usada em qualquer modelo e nas cartelas geradas.');setArtFile(null);if(artUrl){URL.revokeObjectURL(artUrl);setArtUrl(null)};setOpen(false)}catch(e){setMessage(e instanceof Error?e.message:'Não foi possível salvar a imagem de fundo.')}finally{setSaving(false)}}
  return <section className="rounded-2xl border border-red-900/40 bg-red-950/10 p-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h3 className="font-black">Imagem de fundo da cartela</h3><p className="mt-1 text-xs text-slate-400">Uma única imagem por evento. Ela vale para 1 em 1, 2 em 1 e 3 em 1.</p></div><Button onClick={()=>setOpen(v=>!v)}>{initialArtwork?.path?'Ajustar imagem de fundo':'Adicionar imagem de fundo'}</Button></div>
  {!open&&<div className="mt-4"><CardTemplatePreview format={format} layoutKey={template.layout_key} eventName={eventName} seriesCode={series.trim().toUpperCase()||'A'} sequenceNumber={startNumber} codePadding={padding} rule={rule} previewOptions={{...templateOptions,artwork:initialArtwork}}/><p className="mt-2 text-center text-xs text-slate-500">Visualização antes de gerar. A mesma imagem continuará ao trocar de modelo.</p></div>}
  {open&&<div className="mt-4 grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(320px,.9fr)]"><div className="space-y-4"><div><p className="text-sm font-semibold">Escolher imagem</p><label className="mt-2 inline-flex min-h-12 w-full cursor-pointer items-center justify-center rounded-2xl bg-red-600 px-4 py-3 text-base font-black text-white transition hover:bg-red-500 focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-red-400 sm:w-auto"><input className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>choose(e.target.files?.[0]??null)}/>Buscar imagem no aparelho</label><p className="mt-2 text-xs text-slate-400">{artFile?`Selecionada: ${artFile.name}`:(initialArtwork?.path?'A imagem atual já está salva para todo o evento. Escolha outra somente se quiser substituir.':'Nenhuma imagem selecionada.')}</p></div><div className="grid gap-3 sm:grid-cols-2"><label className="text-sm font-semibold">Encaixe<Select className="mt-1" value={fit} onChange={e=>{setFit(e.target.value as ArtworkFit);setZoom(1);setOffsetX(0);setOffsetY(0)}}><option value="cover">Preencher toda a cartela</option><option value="contain">Mostrar a imagem inteira</option></Select></label><label className="text-sm font-semibold">Qualidade<Select className="mt-1" value={quality} onChange={e=>setQuality(e.target.value as ArtworkQuality)}><option value="light">Arquivo leve</option><option value="standard">Impressão padrão</option><option value="high">Alta qualidade</option></Select></label></div><div className="grid gap-3 sm:grid-cols-3"><QuickRange label={`Tamanho ${zoom.toFixed(2)}×`} min={.5} max={3} step={.05} value={zoom} set={setZoom}/><QuickRange label={`Horizontal ${offsetX}%`} min={-60} max={60} step={1} value={offsetX} set={setOffsetX}/><QuickRange label={`Vertical ${offsetY}%`} min={-60} max={60} step={1} value={offsetY} set={setOffsetY}/></div><div className="flex flex-wrap gap-2"><Button variant="secondary" onClick={()=>{setFit('cover');setZoom(1);setOffsetX(0);setOffsetY(0)}}>Centralizar</Button><Button disabled={saving||(!artFile&&!initialArtwork?.path)} onClick={()=>void save()}>{saving?'Salvando…':'Salvar imagem e ajuste'}</Button><Button variant="secondary" onClick={()=>setOpen(false)}>Cancelar</Button></div>{message&&<p className="rounded-xl bg-slate-950/30 p-3 text-xs font-semibold text-slate-300">{message}</p>}</div><div><p className="mb-2 text-xs font-black uppercase tracking-[.14em] text-red-400">Visualização ao vivo</p><CardTemplatePreview format={format} layoutKey={template.layout_key} eventName={eventName} seriesCode={series.trim().toUpperCase()||'A'} sequenceNumber={startNumber} codePadding={padding} rule={rule} previewOptions={options} localArtworkUrl={artUrl??existingUrl}/><p className="mt-2 text-xs text-slate-500">Ajuste uma vez. A arte continuará disponível em todos os modelos deste evento.</p></div></div>}</section>
}

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
