import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { getMasterHomologationDetails, getMasterHomologationStatus, type HomologationDetails, type HomologationStatus } from './masterService'

const MANUAL = [
  ['master-access','Master','Entrar com a conta Master e confirmar que /master abre; outra conta deve ser bloqueada.'],
  ['new-user','Novo cliente','Criar uma conta nova: deve entrar em acesso pendente, visualizar WhatsApp/suporte e não acessar áreas operacionais.'],
  ['support','Suporte','Enviar mensagem e comprovante pela conta bloqueada; responder pelo Master e abrir o anexo.'],
  ['license','Licença','Liberar o cliente com limite de 1 evento, criar 1 evento e confirmar que o segundo é bloqueado pelo banco.'],
  ['seller','Vendedor','Convidar vendedor para apenas um evento e confirmar que ele só vende nesse evento.'],
  ['operator','Operador','Convidar operador e confirmar acesso somente a sorteio, conferência e aparência da TV autorizada.'],
  ['tv','TV pública','Deixar a TV em tela cheia durante duas rodadas e confirmar transição, vencedor, logo e contato do evento.'],
  ['draw','Sorteio','Testar automático, manual, continuado, possível ganhador, rejeição e confirmação sem permitir nova pedra pendente.'],
  ['digital-card','Cartela digital','Abrir uma cartela vendida no celular e confirmar marcação dos números durante o sorteio.'],
  ['full-event','Evento completo','Criar evento → gerar → imprimir → vender → sortear → conferir → finalizar → histórico, sem refresh manual.'],
] as const

const STORAGE_KEY='bingoup.master.phase14.manual.v1'

type DetailKey='pending_winners'|'open_draw_sessions'|'pending_access_users'|'open_support_threads'

export function MasterHomologationTab(){
  const [status,setStatus]=useState<HomologationStatus|null>(null)
  const [details,setDetails]=useState<HomologationDetails|null>(null)
  const [detailOpen,setDetailOpen]=useState<DetailKey|null>(null)
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState<string|null>(null)
  const [done,setDone]=useState<Record<string,boolean>>(()=>{try{return JSON.parse(localStorage.getItem(STORAGE_KEY)??'{}') as Record<string,boolean>}catch{return {}}})
  async function load(){
    setLoading(true);setError(null)
    try{
      const [nextStatus,nextDetails]=await Promise.all([getMasterHomologationStatus(),getMasterHomologationDetails()])
      setStatus(nextStatus);setDetails(nextDetails)
    }catch(e:unknown){
      const message=e instanceof Error?e.message:typeof e==='object'&&e!==null&&'message' in e&&typeof (e as {message?:unknown}).message==='string'?(e as {message:string}).message:'Não foi possível executar a homologação automática.'
      setError(message)
    }finally{setLoading(false)}
  }
  useEffect(()=>{void load()},[])
  function toggle(id:string){setDone(current=>{const next={...current,[id]:!current[id]};localStorage.setItem(STORAGE_KEY,JSON.stringify(next));return next})}
  const completed=useMemo(()=>MANUAL.filter(([id])=>done[id]).length,[done])
  const allManual=completed===MANUAL.length
  const autoReady=status?.status==='ready'
  const actionable:Partial<Record<string,DetailKey>>={winner_resolution:'pending_winners',draws:'open_draw_sessions',pending_access:'pending_access_users',support:'open_support_threads'}
  return <div className="space-y-4">
    <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-xl font-black text-white">Homologação para venda</h2><p className="text-sm text-slate-400">Verificações automáticas do banco + roteiro de teste real antes de liberar clientes.</p></div><Button variant="secondary" disabled={loading} onClick={()=>void load()}>{loading?'Verificando…':'Verificar novamente'}</Button></div>
      {error&&<p className="mt-4 rounded-xl border border-red-900/50 bg-red-950/20 p-3 text-sm text-red-300">{error}</p>}
      {status&&<><div className={`mt-4 rounded-2xl border p-4 ${status.status==='ready'?'border-emerald-800 bg-emerald-950/20':status.status==='attention'?'border-amber-800 bg-amber-950/20':'border-red-800 bg-red-950/20'}`}><strong className="text-white">{status.status==='ready'?'Base automática pronta':status.status==='attention'?'Há itens para conferir':'Existe bloqueio crítico'}</strong><p className="mt-1 text-xs text-slate-400">Verificado em {new Date(status.checked_at).toLocaleString('pt-BR')}.</p></div><div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{status.checks.map(check=>{const key=actionable[check.id];return <button type="button" key={check.id} onClick={()=>key&&setDetailOpen(current=>current===key?null:key)} className={`rounded-xl border border-slate-800 bg-slate-950/40 p-3 text-left ${key?'transition hover:border-slate-600':''}`}><div className="flex items-center gap-2"><span className={`h-2.5 w-2.5 rounded-full ${check.level==='ok'?'bg-emerald-400':check.level==='critical'?'bg-red-500':check.level==='warning'?'bg-amber-400':'bg-sky-400'}`}/><strong className="text-sm text-white">{check.title}</strong>{key&&<span className="ml-auto text-[11px] font-bold text-slate-500">{detailOpen===key?'Fechar':'Ver detalhes →'}</span>}</div><p className="mt-2 text-xs leading-5 text-slate-400">{check.detail}</p></button>})}</div></>}
      {detailOpen&&details&&<DetailPanel kind={detailOpen} details={details}/>}      
    </section>
    <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5"><div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between"><div><h2 className="text-lg font-black text-white">Teste real de ponta a ponta</h2><p className="text-sm text-slate-400">Marque somente depois de executar em contas/dispositivos reais. O progresso fica salvo apenas neste navegador Master.</p></div><p className="text-sm font-black text-white">{completed}/{MANUAL.length}</p></div><div className="mt-4 space-y-2">{MANUAL.map(([id,title,detail])=><label key={id} className="flex cursor-pointer gap-3 rounded-xl border border-slate-800 bg-slate-950/35 p-3"><input className="mt-1" type="checkbox" checked={Boolean(done[id])} onChange={()=>toggle(id)}/><span><strong className="block text-sm text-white">{title}</strong><span className="mt-1 block text-xs leading-5 text-slate-400">{detail}</span></span></label>)}</div><div className={`mt-4 rounded-xl border p-3 text-sm ${autoReady&&allManual?'border-emerald-800 bg-emerald-950/20 text-emerald-300':'border-slate-700 bg-slate-950/50 text-slate-400'}`}>{autoReady&&allManual?'Homologação concluída neste navegador. O BINGOUP está pronto para o teste comercial controlado.':'Para concluir: a verificação automática deve ficar pronta e os 10 testes reais devem ser marcados.'}</div></section>
  </div>
}

function DetailPanel({kind,details}:{kind:DetailKey;details:HomologationDetails}){
  if(kind==='pending_winners')return <Detail title="Possíveis ganhadores pendentes" empty="Nenhuma conferência pendente.">{details.pending_winners.map(row=><div key={row.id} className="flex flex-col gap-2 rounded-xl border border-slate-800 bg-slate-950/60 p-3 sm:flex-row sm:items-center sm:justify-between"><div><strong className="text-sm text-white">{row.event_name} · {row.session_name}</strong><p className="mt-1 text-xs text-slate-400">{row.card_code??'Cartela'} · Jogo {row.game_position??'—'} · detectado em {new Date(row.detected_at).toLocaleString('pt-BR')}</p></div><Link to={`/eventos/${row.event_id}/sorteio`}><Button variant="secondary">Abrir conferência</Button></Link></div>)}</Detail>
  if(kind==='open_draw_sessions')return <Detail title="Sessões abertas ou pausadas" empty="Nenhuma sessão aberta.">{details.open_draw_sessions.map(row=><div key={row.session_id} className="flex flex-col gap-2 rounded-xl border border-slate-800 bg-slate-950/60 p-3 sm:flex-row sm:items-center sm:justify-between"><div><strong className="text-sm text-white">{row.event_name} · {row.session_name}</strong><p className="mt-1 text-xs text-slate-400">{row.status==='active'?'Em andamento':'Pausada'} · {row.called_count} bolas · {row.participant_games} jogos</p></div><Link to={`/eventos/${row.event_id}/sorteio`}><Button variant="secondary">Abrir sorteio</Button></Link></div>)}</Detail>
  if(kind==='pending_access_users')return <Detail title="Usuários aguardando liberação" empty="Nenhum usuário aguardando.">{details.pending_access_users.map(row=><div key={row.user_id} className="rounded-xl border border-slate-800 bg-slate-950/60 p-3"><strong className="text-sm text-white">{row.display_name||row.email||'Usuário'}</strong><p className="mt-1 text-xs text-slate-400">{row.email||'Sem e-mail'} · criado em {new Date(row.created_at).toLocaleString('pt-BR')}</p><p className="mt-1 text-[11px] text-slate-500">Gerencie a liberação na aba Usuários ou Clientes.</p></div>)}</Detail>
  return <Detail title="Atendimentos de suporte abertos" empty="Nenhum atendimento aberto.">{details.open_support_threads.map(row=><div key={row.thread_id} className="rounded-xl border border-slate-800 bg-slate-950/60 p-3"><strong className="text-sm text-white">{row.display_name||row.email||'Usuário'}</strong><p className="mt-1 text-xs text-slate-400">{row.subject} · última atividade {new Date(row.last_message_at).toLocaleString('pt-BR')}</p><p className="mt-1 text-[11px] text-slate-500">Abra a aba Suporte para responder.</p></div>)}</Detail>
}

function Detail({title,empty,children}:{title:string;empty:string;children:React.ReactNode[]}){return <div className="mt-4 rounded-2xl border border-slate-700 bg-slate-950/35 p-4"><h3 className="font-black text-white">{title}</h3><div className="mt-3 space-y-2">{children.length?children:<p className="text-sm text-slate-500">{empty}</p>}</div></div>}
