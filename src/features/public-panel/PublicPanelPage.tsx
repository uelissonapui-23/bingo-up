import {useCallback,useEffect,useMemo,useState} from 'react'
import {useParams} from 'react-router-dom'
import {buildPublicBoardColumns,recentCalledNumbers} from '@/domain/draw/publicBoard'
import {getPublicPanelState,subscribeToPublicPanel,type PublicPanelState} from './publicPanelService'

type ScreenMode='portrait'|'landscape'|'wide'
function getScreenMode():ScreenMode{
  const ratio=window.innerWidth/Math.max(1,window.innerHeight)
  if(ratio<.9)return 'portrait'
  if(ratio>1.7)return 'wide'
  return 'landscape'
}

export function PublicPanelPage(){
  const {publicSessionId}=useParams()
  const [state,setState]=useState<PublicPanelState|null>(null)
  const [error,setError]=useState<string|null>(null)
  const [connected,setConnected]=useState(true)
  const [screenMode,setScreenMode]=useState<ScreenMode>(()=>getScreenMode())
  const [fullscreen,setFullscreen]=useState(()=>Boolean(document.fullscreenElement))
  const load=useCallback(async()=>{if(!publicSessionId)return;try{setState(await getPublicPanelState(publicSessionId));setError(null);setConnected(true)}catch{setConnected(false);setError('Este painel não está disponível ou o link é inválido.')}},[publicSessionId])
  useEffect(()=>{void load()},[load])
  const signalToken=state?.public_token??publicSessionId
  useEffect(()=>{if(!signalToken)return;return subscribeToPublicPanel(signalToken,()=>void load())},[signalToken,load])
  useEffect(()=>{const id=window.setInterval(()=>void load(),3500);return()=>window.clearInterval(id)},[load])
  useEffect(()=>{const resize=()=>setScreenMode(getScreenMode());window.addEventListener('resize',resize);window.addEventListener('orientationchange',resize);return()=>{window.removeEventListener('resize',resize);window.removeEventListener('orientationchange',resize)}},[])
  useEffect(()=>{const changed=()=>setFullscreen(Boolean(document.fullscreenElement));document.addEventListener('fullscreenchange',changed);return()=>document.removeEventListener('fullscreenchange',changed)},[])
  const called=useMemo(()=>new Set(state?.called_numbers??[]),[state?.called_numbers])
  const columns=useMemo(()=>buildPublicBoardColumns(state?.total_balls??75),[state?.total_balls])
  const recent=useMemo(()=>recentCalledNumbers(state?.called_numbers??[],screenMode==='portrait'?5:8),[state?.called_numbers,screenMode])
  async function toggleFullscreen(){
    if(document.fullscreenElement)await document.exitFullscreen?.()
    else await document.documentElement.requestFullscreen?.()
  }
  if(error&&!state)return <main className="grid h-[100dvh] place-items-center overflow-hidden bg-[#080808] p-8 text-white"><div className="max-w-xl text-center"><p className="text-3xl font-black">Painel indisponível</p><p className="mt-3 text-white/55">{error}</p></div></main>
  if(!state)return <main className="grid h-[100dvh] place-items-center overflow-hidden bg-[#080808] text-white"><p className="text-xl font-bold">Carregando painel…</p></main>
  const statusLabel=state.status==='active'?'Sorteio em andamento':state.status==='paused'?'Sorteio pausado':state.status==='finished'?'Rodada encerrada':'Rodada cancelada'
  const compact=screenMode==='portrait'
  return <main className="h-[100dvh] overflow-hidden bg-[#080808] text-white">
    <div className={`mx-auto flex h-full w-full max-w-[2560px] flex-col ${compact?'p-2':'p-3 sm:p-4 xl:p-5'}`}>
      <header className={`flex shrink-0 items-center justify-between gap-2 border-b border-white/10 ${compact?'pb-2':'pb-3'}`}>
        <div className="min-w-0"><p className="truncate text-[10px] font-black uppercase tracking-[.24em] text-red-500 sm:text-xs">BINGOUP · {state.event_name}</p><h1 className={`mt-0.5 truncate font-black ${compact?'text-lg':'text-xl sm:text-2xl xl:text-3xl'}`}>{state.round_name}</h1></div>
        <div className="flex shrink-0 items-center gap-2"><div className="hidden text-right sm:block"><p className="text-xs font-black uppercase tracking-wide text-white/80">{statusLabel}</p><p className="text-[11px] text-white/45">Prêmio: {state.win_pattern_name}</p></div><span className={`size-2.5 rounded-full ${connected?'bg-emerald-400':'bg-amber-400'}`} title={connected?'Painel sincronizado':'Reconectando'}/><button type="button" onClick={()=>void toggleFullscreen()} className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs font-bold hover:bg-white/10">{fullscreen?'Sair da tela cheia':'Tela cheia'}</button></div>
      </header>

      {state.confirmed_bingo?<PublicWinner count={state.confirmed_winners}/>:state.possible_bingo?<PossibleWinner/>:compact?
        <PortraitPanel state={state} called={called} columns={columns} recent={recent} connected={connected}/>
        :<LandscapePanel state={state} called={called} columns={columns} recent={recent} wide={screenMode==='wide'}/>
      }
      <footer className="flex shrink-0 items-center justify-between border-t border-white/10 pt-1.5 text-[9px] font-semibold uppercase tracking-wider text-white/25 sm:text-[10px]"><span>BINGOUP · Tela pública</span><span>{screenMode==='portrait'?'Vertical':screenMode==='wide'?'Panorâmica':'Horizontal'} · {connected?'Ao vivo':'Reconectando…'}</span></footer>
    </div>
  </main>
}

function LandscapePanel({state,called,columns,recent,wide}:{state:PublicPanelState;called:Set<number>;columns:ReturnType<typeof buildPublicBoardColumns>;recent:number[];wide:boolean}){
  return <div className={`grid min-h-0 flex-1 gap-3 py-2 ${wide?'grid-cols-[minmax(220px,.48fr)_minmax(0,1.52fr)]':'grid-cols-[minmax(210px,.58fr)_minmax(0,1.42fr)]'}`}>
    <section className="flex min-h-0 flex-col gap-2">
      <div className="grid min-h-0 flex-1 place-items-center rounded-3xl border border-white/10 bg-white/[.045] p-2 text-center"><div><p className="text-xs font-black uppercase tracking-[.26em] text-white/45">Último número</p><p className="text-[clamp(5rem,20vh,13rem)] font-black leading-[.78] tracking-tighter text-red-500">{state.last_called_number??'—'}</p></div></div>
      {recent.length>0&&<RecentNumbers recent={recent}/>}<div className="grid grid-cols-2 gap-2"><Metric value={state.called_count} label={`de ${state.total_balls}`}/><Metric value={state.total_balls-state.called_count} label="restantes"/></div>{state.show_near_winners&&<div className="grid grid-cols-2 gap-2"><NearCard value={state.one_away??0} label="Falta 1" hot/><NearCard value={state.two_away??0} label="Faltam 2"/></div>}
    </section>
    <Board columns={columns} called={called}/>
  </div>
}

function PortraitPanel({state,called,columns,recent}:{state:PublicPanelState;called:Set<number>;columns:ReturnType<typeof buildPublicBoardColumns>;recent:number[];connected:boolean}){
  return <div className="grid min-h-0 flex-1 grid-rows-[auto_minmax(0,1fr)] gap-2 py-2">
    <section className="grid grid-cols-[1.15fr_.85fr_.85fr] gap-2">
      <div className="grid place-items-center rounded-2xl border border-white/10 bg-white/[.045] p-2 text-center"><div><p className="text-[9px] font-black uppercase tracking-[.18em] text-white/45">Último</p><p className="text-[clamp(3.6rem,11vh,6.5rem)] font-black leading-none text-red-500">{state.last_called_number??'—'}</p></div></div>
      <div className="grid gap-2"><Metric value={state.called_count} label="sorteados"/><Metric value={state.total_balls-state.called_count} label="restantes"/></div>
      <div className="grid gap-2">{state.show_near_winners?<><NearCard value={state.one_away??0} label="Falta 1" hot/><NearCard value={state.two_away??0} label="Faltam 2"/></>:<RecentNumbers recent={recent}/>}</div>
    </section>
    <Board columns={columns} called={called} compact/>
  </div>
}

function Board({columns,called,compact=false}:{columns:ReturnType<typeof buildPublicBoardColumns>;called:Set<number>;compact?:boolean}){return <section className="min-h-0 overflow-hidden rounded-3xl border border-white/10 bg-white/[.035] p-2 sm:p-3"><div className="flex h-full min-h-0 flex-col"><div className="flex shrink-0 items-center justify-between gap-2 pb-2"><h2 className={`${compact?'text-sm':'text-base sm:text-lg'} font-black`}>Números sorteados</h2><span className="text-[9px] font-bold text-white/35 sm:text-[10px]">Atualização automática</span></div><div className="grid min-h-0 flex-1 grid-cols-5 gap-1 sm:gap-1.5">{columns.map(column=><div key={column.label} className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-1"><div className={`grid place-items-center rounded-lg bg-red-600 font-black ${compact?'h-7 text-sm':'h-8 text-base sm:h-9 sm:text-lg'}`}>{column.label}</div><div className="grid min-h-0 gap-0.5 sm:gap-1" style={{gridTemplateRows:`repeat(${Math.max(1,column.numbers.length)},minmax(0,1fr))`}}>{column.numbers.map(n=><div key={n} style={{fontSize:'clamp(.55rem,1.55vmin,1.35rem)'}} className={`grid min-h-0 place-items-center rounded border font-black leading-none ${called.has(n)?'border-red-500 bg-red-500 text-white':'border-white/10 bg-black/25 text-white/28'}`}>{n}</div>)}</div></div>)}</div></div></section>}
function RecentNumbers({recent}:{recent:number[]}){return <div className="rounded-2xl border border-white/10 bg-white/[.035] p-2"><p className="text-center text-[9px] font-black uppercase tracking-[.18em] text-white/40">Últimos</p><div className="mt-1 flex flex-wrap justify-center gap-1.5">{recent.map((number,index)=><span key={`${number}-${index}`} className={`grid size-8 place-items-center rounded-full border text-xs font-black ${index===0?'border-red-500 bg-red-500 text-white':'border-white/15 bg-white/5 text-white/80'}`}>{number}</span>)}</div></div>}
function Metric({value,label}:{value:number;label:string}){return <div className="grid place-items-center rounded-2xl border border-white/10 bg-white/[.04] p-2 text-center"><div><p className="text-2xl font-black sm:text-3xl">{value}</p><p className="text-[9px] font-bold uppercase tracking-wide text-white/40 sm:text-[10px]">{label}</p></div></div>}
function NearCard({value,label,hot=false}:{value:number;label:string;hot?:boolean}){return <div className={`grid place-items-center rounded-2xl border p-2 text-center ${hot?'border-amber-400/35 bg-amber-400/10':'border-white/10 bg-white/[.04]'}`}><div><p className={`text-2xl font-black sm:text-3xl ${hot?'text-amber-300':'text-white'}`}>{value}</p><p className="text-[9px] font-bold uppercase tracking-wider text-white/45 sm:text-[10px]">{label}</p></div></div>}
function PossibleWinner(){return <section className="grid min-h-0 flex-1 place-items-center py-4 text-center"><div><p className="text-[clamp(3rem,10vmin,8rem)]">🏆</p><h2 className="text-[clamp(2.5rem,7vmin,7rem)] font-black leading-none tracking-tight text-amber-300">POSSÍVEL BINGO</h2><p className="mt-4 text-[clamp(1rem,2vmin,1.8rem)] font-bold text-white/75">Sorteio pausado. Aguarde a conferência da organização.</p></div></section>}
function PublicWinner({count}:{count:number}){return <section className="grid min-h-0 flex-1 place-items-center py-4 text-center"><div><p className="text-[clamp(3rem,10vmin,8rem)]">🏆</p><h2 className="text-[clamp(3rem,8vmin,8rem)] font-black leading-none tracking-tight text-red-500">BINGO!</h2><p className="mt-4 text-[clamp(1rem,2.2vmin,2rem)] font-bold text-white">{count>1?`${count} vencedores confirmados`:'Vencedor confirmado'}</p></div></section>}
