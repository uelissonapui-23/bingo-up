import {useCallback,useEffect,useState} from 'react'
import {Button} from '@/components/ui/Button'
import {Card} from '@/components/ui/Card'
import {countChecks,type EventOperationalHealth} from '@/domain/operations/health'
import {getEventOperationalHealth} from './operationalService'

export function EventOperationalHealthCard({eventId}:{eventId:string}){
  const [health,setHealth]=useState<EventOperationalHealth|null>(null)
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState('')
  const load=useCallback(async(silent=false)=>{
    if(!silent)setLoading(true)
    try{setHealth(await getEventOperationalHealth(eventId));setError('')}
    catch(e:any){setError(e?.message??'Não foi possível verificar a operação.')}
    finally{if(!silent)setLoading(false)}
  },[eventId])
  useEffect(()=>{void load();const timer=window.setInterval(()=>void load(true),15000);const sync=()=>void load(true);window.addEventListener('online',sync);window.addEventListener('focus',sync);return()=>{window.clearInterval(timer);window.removeEventListener('online',sync);window.removeEventListener('focus',sync)}},[load])
  const counts=health?countChecks(health):null
  const title=health?.overall==='ready'?'Pronto para operar':health?.overall==='critical'?'Atenção crítica':'Revisar antes de operar'
  return <Card className={health?.overall==='critical'?'border-red-800/70':health?.overall==='attention'?'border-amber-700/60':'border-emerald-800/50'}>
    <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[.16em] text-slate-500">Produção inicial</p><h2 className="mt-1 text-lg font-black">Monitoramento do evento</h2><p className="mt-1 text-xs text-slate-500">Verificação independente da tela. Atualiza em segundo plano sem resetar formulários ou o sorteio.</p></div><Button variant="secondary" disabled={loading} onClick={()=>void load()}>{loading?'Verificando…':'Verificar agora'}</Button></div>
    {error&&<div className="mt-4 rounded-xl border border-amber-800/50 bg-amber-950/20 p-3 text-sm text-amber-200">Falha temporária no monitoramento: {error}. O restante do evento continua disponível.</div>}
    {health&&<><div className="mt-4 grid gap-3 sm:grid-cols-3"><Metric label="Situação" value={title}/><Metric label="Cartelas vendidas" value={`${health.cards_sold} / ${health.cards_issued}`}/><Metric label="Sorteio" value={health.open_draws?`${health.open_draws} aberto`:'Sem rodada aberta'}/></div>
      <div className="mt-4 flex flex-wrap gap-2 text-xs font-bold"><Pill tone="ok">{counts?.ok??0} OK</Pill>{(counts?.warning??0)>0&&<Pill tone="warning">{counts?.warning} aviso(s)</Pill>}{(counts?.critical??0)>0&&<Pill tone="critical">{counts?.critical} crítico(s)</Pill>}</div>
      <div className="mt-4 space-y-2">{health.checks.map(check=><div key={check.code} className="flex gap-3 rounded-xl border border-slate-800/70 bg-slate-950/25 p-3"><span className={`mt-0.5 size-2.5 shrink-0 rounded-full ${check.level==='ok'?'bg-emerald-400':check.level==='warning'?'bg-amber-400':'bg-red-500'}`}/><div><p className="text-sm font-bold text-white">{check.label}</p><p className="mt-0.5 text-xs text-slate-400">{check.detail}</p></div></div>)}</div>
      <p className="mt-4 text-[11px] text-slate-500">Servidor verificado em {new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'medium'}).format(new Date(health.server_time))}{health.last_activity_at?` · Última atividade ${new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short'}).format(new Date(health.last_activity_at))}`:''}</p>
    </>}
  </Card>
}
function Metric({label,value}:{label:string;value:string}){return <div className="rounded-xl bg-slate-950/35 p-3"><p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-1 text-sm font-black text-white">{value}</p></div>}
function Pill({tone,children}:{tone:'ok'|'warning'|'critical';children:React.ReactNode}){return <span className={`rounded-full px-2.5 py-1 ${tone==='ok'?'bg-emerald-950/50 text-emerald-300':tone==='warning'?'bg-amber-950/50 text-amber-300':'bg-red-950/50 text-red-300'}`}>{children}</span>}
