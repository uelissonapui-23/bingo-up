import {useCallback,useEffect,useMemo,useState} from 'react'
import {useParams} from 'react-router-dom'
import {getPublicPanelState,subscribeToPublicPanel,type PublicPanelState} from './publicPanelService'

export function PublicPanelPage(){
  const {publicSessionId}=useParams()
  const [state,setState]=useState<PublicPanelState|null>(null)
  const [error,setError]=useState<string|null>(null)
  const load=useCallback(async()=>{if(!publicSessionId)return;try{setState(await getPublicPanelState(publicSessionId));setError(null)}catch{setError('Este painel não está disponível ou o link é inválido.')}},[publicSessionId])
  useEffect(()=>{void load()},[load])
  useEffect(()=>{if(!publicSessionId)return;return subscribeToPublicPanel(publicSessionId,()=>void load())},[publicSessionId,load])
  // Fallback leve para redes que bloqueiam websocket; Realtime continua sendo o caminho principal.
  useEffect(()=>{const id=window.setInterval(()=>void load(),15000);return()=>window.clearInterval(id)},[load])
  const called=useMemo(()=>new Set(state?.called_numbers??[]),[state?.called_numbers])
  if(error)return <main className="grid min-h-dvh place-items-center bg-slate-950 p-8 text-white"><div className="max-w-xl text-center"><p className="text-3xl font-black">Painel indisponível</p><p className="mt-3 text-slate-400">{error}</p></div></main>
  if(!state)return <main className="grid min-h-dvh place-items-center bg-slate-950 text-white"><p className="text-xl font-bold">Carregando painel…</p></main>
  const statusLabel=state.status==='active'?'Sorteio em andamento':state.status==='paused'?'Sorteio pausado':state.status==='finished'?'Rodada encerrada':'Rodada cancelada'
  return <main className="min-h-dvh overflow-hidden bg-slate-950 p-4 text-white sm:p-6 lg:p-8">
    <div className="mx-auto flex min-h-[calc(100dvh-2rem)] max-w-[1800px] flex-col sm:min-h-[calc(100dvh-3rem)] lg:min-h-[calc(100dvh-4rem)]">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-white/10 pb-4"><div><p className="text-sm font-bold uppercase tracking-[.25em] text-emerald-400">{state.event_name}</p><h1 className="mt-1 text-2xl font-black sm:text-3xl">{state.round_name}</h1></div><div className="text-right"><p className="text-sm font-bold text-slate-300">{statusLabel}</p><p className="text-xs text-slate-500">Prêmio: {state.win_pattern_name}</p></div></header>
      {state.confirmed_bingo?<PublicWinner count={state.confirmed_winners}/>:state.possible_bingo?<PossibleWinner/>:<div className="grid flex-1 gap-5 py-5 lg:grid-cols-[.72fr_1.28fr]">
        <section className="flex flex-col gap-5"><div className="grid flex-1 place-items-center rounded-[2rem] border border-white/10 bg-white/[.04] p-6 text-center"><div><p className="text-sm font-black uppercase tracking-[.28em] text-slate-400">Último número</p><p className="mt-2 text-[clamp(6rem,20vw,16rem)] font-black leading-none tracking-tighter">{state.last_called_number??'—'}</p></div></div>{state.show_progress&&<div className="rounded-[2rem] border border-white/10 bg-white/[.04] p-5 text-center"><p className="text-sm font-bold uppercase tracking-[.2em] text-slate-400">Números sorteados</p><p className="mt-2 text-4xl font-black sm:text-5xl">{state.called_count} <span className="text-xl text-slate-500">/ {state.total_balls}</span></p></div>}{state.show_near_winners&&<div className="grid grid-cols-2 gap-4"><NearCard value={state.one_away??0} label="Falta 1" hot/><NearCard value={state.two_away??0} label="Faltam 2"/></div>}</section>
        <section className="rounded-[2rem] border border-white/10 bg-white/[.04] p-4 sm:p-6"><div className="flex items-center justify-between"><h2 className="text-lg font-black sm:text-2xl">Números que já saíram</h2><span className="text-sm font-bold text-slate-500">{state.total_balls-state.called_count} restantes</span></div><div className="mt-5 grid grid-cols-10 gap-1.5 sm:gap-2 lg:gap-2.5">{Array.from({length:state.total_balls},(_,i)=>i+1).map(n=><div key={n} className={`grid aspect-square place-items-center rounded-lg border text-[clamp(.7rem,1.6vw,1.5rem)] font-black ${called.has(n)?'border-emerald-400 bg-emerald-500 text-slate-950 shadow-[0_0_24px_rgba(52,211,153,.18)]':'border-white/10 bg-black/20 text-slate-600'}`}>{n}</div>)}</div></section>
      </div>}
    </div>
  </main>
}
function NearCard({value,label,hot=false}:{value:number;label:string;hot?:boolean}){return <div className={`rounded-[2rem] border p-5 text-center ${hot?'border-amber-400/40 bg-amber-400/10':'border-white/10 bg-white/[.04]'}`}><p className={`text-5xl font-black ${hot?'text-amber-300':'text-white'}`}>{value}</p><p className="mt-1 text-sm font-bold uppercase tracking-wider text-slate-400">{label}</p><p className="mt-1 text-xs text-slate-500">{value===1?'jogo próximo':'jogos próximos'}</p></div>}
function PossibleWinner(){return <section className="grid flex-1 place-items-center py-8 text-center"><div><p className="text-[clamp(4rem,12vw,10rem)]">🏆</p><h2 className="text-[clamp(3rem,8vw,8rem)] font-black leading-none tracking-tight text-amber-300">POSSÍVEL BINGO</h2><p className="mt-6 text-[clamp(1.2rem,2.4vw,2.2rem)] font-bold text-slate-300">Aguarde a conferência da organização</p></div></section>}
function PublicWinner({count}:{count:number}){return <section className="grid flex-1 place-items-center py-8 text-center"><div><p className="text-[clamp(4rem,12vw,10rem)]">🏆</p><h2 className="text-[clamp(3.5rem,10vw,9rem)] font-black leading-none tracking-tight text-emerald-300">BINGO!</h2><p className="mt-6 text-[clamp(1.3rem,2.8vw,2.5rem)] font-bold text-white">{count>1?`${count} vencedores confirmados`:'Vencedor confirmado'}</p></div></section>}
