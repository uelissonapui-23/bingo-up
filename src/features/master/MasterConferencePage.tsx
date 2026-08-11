import {useCallback,useEffect,useMemo,useState} from 'react'
import {Link,useParams} from 'react-router-dom'
import {Button} from '@/components/ui/Button'
import {Card} from '@/components/ui/Card'
import {supabase} from '@/services/supabase/client'

type MasterConference = {
  candidate_id:string
  candidate_status:string
  detected_at:string
  event_id:string
  event_name:string
  event_status:string
  workspace_id:string
  workspace_name:string
  session_id:string
  session_name:string
  session_number:number
  session_status:string
  card_code:string|null
  card_status:string|null
  game_position:number|null
  game_cells:Array<number|null>
  called_numbers:number[]
  missing_count:number
  matched_count:number
  is_winner:boolean
  trigger_number:number|null
  buyer_name:string|null
  buyer_phone:string|null
  resolution_note:string|null
}

async function loadConference(candidateId:string){
  const {data,error}=await supabase.rpc('master_get_winner_candidate_conference',{target_candidate_id:candidateId})
  if(error)throw error
  return data as MasterConference
}
async function resolveConference(candidateId:string,decision:'confirmed'|'dismissed',note?:string){
  const {error}=await supabase.rpc('master_resolve_winner_candidate',{target_candidate_id:candidateId,target_decision:decision,target_note:note??null})
  if(error)throw error
}

export function MasterConferencePage(){
  const {candidateId}=useParams();const [data,setData]=useState<MasterConference|null>(null);const [loading,setLoading]=useState(true);const [busy,setBusy]=useState(false);const [error,setError]=useState<string|null>(null);const [notice,setNotice]=useState<string|null>(null)
  const load=useCallback(async()=>{if(!candidateId)return;setLoading(true);setError(null);try{setData(await loadConference(candidateId))}catch(e){setError(e instanceof Error?e.message:'Não foi possível carregar a conferência.')}finally{setLoading(false)}},[candidateId])
  useEffect(()=>{void load()},[load])
  const called=useMemo(()=>new Set(data?.called_numbers??[]),[data])
  async function decide(decision:'confirmed'|'dismissed'){
    if(!data||!candidateId||data.candidate_status!=='detected')return
    let note:string|undefined
    if(decision==='dismissed'){
      const reason=prompt('Informe o motivo para marcar este jogo como não ganhador:')?.trim()
      if(!reason)return
      note=reason
    }else if(!confirm(`Confirmar ${data.card_code??'esta cartela'} · Jogo ${data.game_position??'—'} como vencedor?`))return
    setBusy(true);setError(null);setNotice(null)
    try{await resolveConference(candidateId,decision,note);setNotice(decision==='confirmed'?'Vencedor confirmado com segurança.':'Jogo marcado como não ganhador.');await load()}catch(e){setError(e instanceof Error?e.message:'Não foi possível concluir a conferência.')}finally{setBusy(false)}
  }
  return <div className="bingoup-app min-h-dvh bg-slate-950 p-4 text-white sm:p-6">
    <div className="mx-auto max-w-5xl space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="bingoup-eyebrow">BINGOUP MASTER</p><h1 className="text-2xl font-black">Conferência da homologação</h1><p className="mt-1 text-sm text-slate-400">Visualização Master protegida. Não depende do workspace atualmente selecionado no organizador.</p></div><Link to="/master"><Button variant="secondary">Voltar ao Master</Button></Link></div>
      {error&&<div className="rounded-xl border border-red-800 bg-red-950/30 p-4 text-red-300">{error}</div>}{notice&&<div className="rounded-xl border border-emerald-800 bg-emerald-950/30 p-4 text-emerald-300">{notice}</div>}
      {loading?<Card>Carregando conferência…</Card>:data?<>
        <Card><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase text-slate-500">{data.workspace_name}</p><h2 className="mt-1 text-xl font-black">{data.event_name} · {data.session_name}</h2><p className="mt-1 text-sm text-slate-400">Evento {data.event_status} · sessão {data.session_status} · detectado em {new Date(data.detected_at).toLocaleString('pt-BR')}</p></div><span className="rounded-full bg-amber-950/50 px-3 py-1 text-xs font-black uppercase text-amber-300">{data.candidate_status}</span></div></Card>
        <Card><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-2xl font-black">{data.card_code??'Cartela'} · Jogo {data.game_position??'—'}</h2>{data.buyer_name&&<p className="mt-1 text-sm text-slate-400">Comprador: {data.buyer_name}{data.buyer_phone?` · ${data.buyer_phone}`:''}</p>}</div><span className={`rounded-full px-3 py-1 text-xs font-black ${data.is_winner?'bg-emerald-950 text-emerald-300':'bg-red-950 text-red-300'}`}>{data.is_winner?'PADRÃO COMPLETO':'PADRÃO NÃO COMPLETO'}</span></div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3"><Mini label="Faltam" value={String(data.missing_count)}/><Mini label="Marcados" value={String(data.matched_count)}/><Mini label="Bola decisiva" value={data.trigger_number?String(data.trigger_number):'—'}/></div>
          <div className="mt-5"><div className="mb-2 flex items-center gap-2 text-xs text-slate-400"><span className="inline-block size-3 rounded bg-emerald-600"/>Número já sorteado</div><div className="grid grid-cols-5 gap-1">{['B','I','N','G','O'].map(x=><b key={x} className="py-1 text-center text-xs">{x}</b>)}{(data.game_cells??[]).map((n,i)=>{const marked=n===null||called.has(n);return <span key={i} className={`rounded border py-2 text-center text-xs font-black ${marked?'border-emerald-600 bg-emerald-600 text-white':'border-slate-700 bg-slate-900 text-slate-200'}`}>{n===null?'★':String(n).padStart(2,'0')}</span>})}</div></div>
          {data.resolution_note&&<div className="mt-4 rounded-xl bg-slate-950/60 p-3 text-sm text-slate-300"><b>Decisão registrada:</b> {data.resolution_note}</div>}
          {data.candidate_status==='detected'&&<div className="mt-5 grid gap-2 sm:grid-cols-2"><Button disabled={busy||!data.is_winner} onClick={()=>void decide('confirmed')}>Confirmar vencedor</Button><Button variant="secondary" disabled={busy} onClick={()=>void decide('dismissed')}>Marcar como não ganhador</Button></div>}
        </Card>
      </>:null}
    </div>
  </div>
}
function Mini({label,value}:{label:string;value:string}){return <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3"><p className="text-[11px] font-bold uppercase text-slate-500">{label}</p><p className="mt-1 text-xl font-black">{value}</p></div>}
