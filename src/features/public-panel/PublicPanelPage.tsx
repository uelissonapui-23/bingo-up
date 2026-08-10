import {useCallback,useEffect,useMemo,useState} from 'react'
import {useParams} from 'react-router-dom'
import {buildPublicBoardColumns,recentCalledNumbers} from '@/domain/draw/publicBoard'
import {getPublicPanelState,subscribeToPublicPanel,type PublicPanelState} from './publicPanelService'

export function PublicPanelPage(){
  const {publicSessionId}=useParams()
  const [state,setState]=useState<PublicPanelState|null>(null)
  const [error,setError]=useState<string|null>(null)
  const [connected,setConnected]=useState(true)
  const load=useCallback(async()=>{if(!publicSessionId)return;try{setState(await getPublicPanelState(publicSessionId));setError(null);setConnected(true)}catch{setConnected(false);setError(current=>state?current:'Este painel não está disponível ou o link é inválido.')}},[publicSessionId,state])
  useEffect(()=>{void load()},[load])
  useEffect(()=>{if(!publicSessionId)return;return subscribeToPublicPanel(publicSessionId,()=>void load())},[publicSessionId,load])
  useEffect(()=>{const id=window.setInterval(()=>void load(),12000);return()=>window.clearInterval(id)},[load])
  const called=useMemo(()=>new Set(state?.called_numbers??[]),[state?.called_numbers])
  const columns=useMemo(()=>buildPublicBoardColumns(state?.total_balls??75),[state?.total_balls])
  const recent=useMemo(()=>recentCalledNumbers(state?.called_numbers??[],8),[state?.called_numbers])
  if(error&&!state)return <main className="grid min-h-dvh place-items-center bg-[#080808] p-8 text-white"><div className="max-w-xl text-center"><p className="text-3xl font-black">Painel indisponível</p><p className="mt-3 text-white/55">{error}</p></div></main>
  if(!state)return <main className="grid min-h-dvh place-items-center bg-[#080808] text-white"><p className="text-xl font-bold">Carregando painel…</p></main>
  const statusLabel=state.status==='active'?'Sorteio em andamento':state.status==='paused'?'Sorteio pausado':state.status==='finished'?'Rodada encerrada':'Rodada cancelada'
  return <main className="min-h-dvh overflow-hidden bg-[#080808] text-white">
    <div className="mx-auto flex min-h-dvh w-full max-w-[1920px] flex-col p-3 sm:p-5 xl:p-7">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
        <div className="min-w-0"><p className="truncate text-xs font-black uppercase tracking-[.28em] text-red-500 sm:text-sm">BINGOUP · {state.event_name}</p><h1 className="mt-1 truncate text-xl font-black sm:text-3xl xl:text-4xl">{state.round_name}</h1></div>
        <div className="flex items-center gap-3"><div className="text-right"><p className="text-xs font-black uppercase tracking-wide text-white/80 sm:text-sm">{statusLabel}</p><p className="text-xs text-white/45">Prêmio: {state.win_pattern_name}</p></div><span className={`size-3 rounded-full ${connected?'bg-emerald-400':'bg-amber-400'}`} title={connected?'Painel sincronizado':'Reconectando'}/><button type="button" onClick={()=>void document.documentElement.requestFullscreen?.()} className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs font-bold hover:bg-white/10">Tela cheia</button></div>
      </header>

      {state.confirmed_bingo?<PublicWinner count={state.confirmed_winners}/>:state.possible_bingo?<PossibleWinner/>:<div className="grid min-h-0 flex-1 gap-3 py-3 lg:grid-cols-[minmax(260px,.56fr)_minmax(0,1.44fr)] xl:gap-5 xl:py-5">
        <section className="flex min-h-0 flex-col gap-3 xl:gap-4">
          <div className="grid min-h-[190px] flex-1 place-items-center rounded-3xl border border-white/10 bg-white/[.045] p-4 text-center xl:rounded-[2rem]"><div><p className="text-xs font-black uppercase tracking-[.28em] text-white/45 sm:text-sm">Último número</p><p className="mt-1 text-[clamp(6.5rem,18vh,15rem)] font-black leading-[.82] tracking-tighter text-red-500">{state.last_called_number??'—'}</p></div></div>
          {recent.length>0&&<div className="rounded-3xl border border-white/10 bg-white/[.035] p-3"><p className="text-center text-[11px] font-black uppercase tracking-[.22em] text-white/40">Últimos chamados</p><div className="mt-2 flex flex-wrap justify-center gap-2">{recent.map((number,index)=><span key={`${number}-${index}`} className={`grid size-10 place-items-center rounded-full border text-sm font-black ${index===0?'border-red-500 bg-red-500 text-white':'border-white/15 bg-white/5 text-white/80'}`}>{number}</span>)}</div></div>}
          <div className="grid grid-cols-2 gap-3">{state.show_progress&&<Metric value={state.called_count} label={`de ${state.total_balls} sorteados`}/>}<Metric value={state.total_balls-state.called_count} label="restantes"/></div>
          {state.show_near_winners&&<div className="grid grid-cols-2 gap-3"><NearCard value={state.one_away??0} label="Falta 1" hot/><NearCard value={state.two_away??0} label="Faltam 2"/></div>}
        </section>
        <section className="min-h-0 rounded-3xl border border-white/10 bg-white/[.035] p-3 sm:p-4 xl:rounded-[2rem] xl:p-5">
          <div className="flex items-center justify-between gap-2"><h2 className="text-base font-black sm:text-xl xl:text-2xl">Números sorteados</h2><span className="text-xs font-bold text-white/35 sm:text-sm">Atualização automática</span></div>
          <div className="mt-3 grid h-[calc(100%-2.25rem)] min-h-[390px] grid-cols-5 gap-1.5 sm:gap-2 xl:gap-3">{columns.map(column=><div key={column.label} className="grid min-h-0 grid-rows-[auto_1fr] gap-1.5"><div className="grid h-9 place-items-center rounded-xl bg-red-600 text-lg font-black sm:h-10 sm:text-xl xl:h-12 xl:text-2xl">{column.label}</div><div className="grid min-h-0 gap-1.5 sm:gap-2" style={{gridTemplateRows:`repeat(${Math.max(1,column.numbers.length)},minmax(0,1fr))`}}>{column.numbers.map(n=><div key={n} className={`grid min-h-0 place-items-center rounded-lg border text-[clamp(.72rem,1.5vw,1.55rem)] font-black transition-colors ${called.has(n)?'border-red-500 bg-red-500 text-white':'border-white/10 bg-black/25 text-white/28'}`}>{n}</div>)}</div></div>)}</div>
        </section>
      </div>}
      <footer className="flex items-center justify-between border-t border-white/10 pt-2 text-[10px] font-semibold uppercase tracking-wider text-white/25 sm:text-xs"><span>BINGOUP · Tela pública</span><span>{connected?'Ao vivo':'Reconectando…'}</span></footer>
    </div>
  </main>
}

function Metric({value,label}:{value:number;label:string}){return <div className="rounded-2xl border border-white/10 bg-white/[.04] p-3 text-center"><p className="text-3xl font-black xl:text-4xl">{value}</p><p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-white/40 sm:text-xs">{label}</p></div>}
function NearCard({value,label,hot=false}:{value:number;label:string;hot?:boolean}){return <div className={`rounded-2xl border p-3 text-center ${hot?'border-amber-400/35 bg-amber-400/10':'border-white/10 bg-white/[.04]'}`}><p className={`text-3xl font-black xl:text-4xl ${hot?'text-amber-300':'text-white'}`}>{value}</p><p className="mt-1 text-xs font-bold uppercase tracking-wider text-white/45">{label}</p></div>}
function PossibleWinner(){return <section className="grid flex-1 place-items-center py-8 text-center"><div><p className="text-[clamp(4rem,12vw,10rem)]">🏆</p><h2 className="text-[clamp(3rem,8vw,8rem)] font-black leading-none tracking-tight text-amber-300">POSSÍVEL BINGO</h2><p className="mt-6 text-[clamp(1.2rem,2.4vw,2.2rem)] font-bold text-white/75">Sorteio pausado. Aguarde a conferência da organização.</p></div></section>}
function PublicWinner({count}:{count:number}){return <section className="grid flex-1 place-items-center py-8 text-center"><div><p className="text-[clamp(4rem,12vw,10rem)]">🏆</p><h2 className="text-[clamp(3.5rem,10vw,9rem)] font-black leading-none tracking-tight text-red-500">BINGO!</h2><p className="mt-6 text-[clamp(1.3rem,2.8vw,2.5rem)] font-bold text-white">{count>1?`${count} vencedores confirmados`:'Vencedor confirmado'}</p></div></section>}
