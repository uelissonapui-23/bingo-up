import {useCallback,useEffect,useMemo,useRef,useState} from 'react'
import {useParams} from 'react-router-dom'
import {getPublicDigitalCard,type PublicDigitalCardState,type PublicDigitalGame} from './publicDigitalCardService'
import {markedNumbers,normalizeCalledNumbers} from '@/domain/cards/publicDigitalCard'

export function PublicCardPlaceholderPage(){
  const {token}=useParams();const [state,setState]=useState<PublicDigitalCardState|null>(null);const [error,setError]=useState<string|null>(null);const busy=useRef(false)
  const load=useCallback(async()=>{if(!token||busy.current)return;busy.current=true;try{const next=await getPublicDigitalCard(token);setState(next);setError(null)}catch{setError('Não foi possível sincronizar a cartela agora.')}finally{busy.current=false}},[token])
  useEffect(()=>{
    const sync=()=>{if(document.visibilityState==='visible')void load()}
    sync()
    const id=window.setInterval(sync,2000)
    document.addEventListener('visibilitychange',sync)
    window.addEventListener('online',sync)
    return()=>{window.clearInterval(id);document.removeEventListener('visibilitychange',sync);window.removeEventListener('online',sync)}
  },[load])
  const called=useMemo(()=>normalizeCalledNumbers(state?.draw?.called_numbers),[state?.draw?.called_numbers])
  if(!state&&!error)return <Shell><p className="text-center text-slate-300">Carregando sua cartela…</p></Shell>
  if(state&&!state.available)return <Shell><div className="text-center"><p className="text-sm font-black uppercase tracking-[.2em] text-amber-400">Cartela digital</p><h1 className="mt-3 text-3xl font-black">Acesso ainda não liberado</h1><p className="mt-3 text-sm text-slate-300">A cartela digital fica disponível somente depois que a venda da cartela física é concluída.</p></div></Shell>
  if(!state?.card||!state.event||!state.rule)return <Shell><p className="text-center text-red-300">{error??'Cartela indisponível.'}</p></Shell>
  return <main className="min-h-dvh bg-slate-950 text-white"><div className="mx-auto max-w-5xl p-3 sm:p-5">
    <header className="sticky top-0 z-20 rounded-2xl border border-slate-800 bg-slate-950/95 p-4 shadow-xl backdrop-blur"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[.22em] text-emerald-400">Cartela digital · {state.event.name}</p><h1 className="mt-1 text-2xl font-black">{state.card.code}</h1><p className="text-xs text-slate-400">Série {state.card.series_code} · {state.card.physical_format} em 1</p></div><div className="text-right"><p className="text-xs font-bold uppercase text-slate-500">Última bola</p><div className="mt-1 inline-grid h-14 min-w-14 place-items-center rounded-full border-2 border-red-500 bg-red-600 px-3 text-2xl font-black">{state.draw?.last_called_number??'—'}</div></div></div>
      {state.draw&&<div className="mt-3 flex flex-wrap gap-2 text-xs"><Badge>{state.draw.name}</Badge><Badge>{state.draw.called_count} bolas chamadas</Badge>{state.draw.status==='paused'&&<Badge tone="warning">Pausado para conferência</Badge>}{state.draw.is_winner&&<Badge tone="success">Esta cartela tem jogo vencedor confirmado</Badge>}</div>}
    </header>
    {error&&<div className="mt-3 rounded-xl border border-amber-700/50 bg-amber-950/30 p-3 text-sm text-amber-200">Sem sincronização momentânea. Mantendo os últimos dados recebidos.</div>}
    <section className="mt-4 grid gap-4 md:grid-cols-2">{(state.games??[]).map(game=><GameCard key={game.position} game={game} cols={state.rule!.grid_columns} labels={(state.rule!.column_definitions??[]).map(c=>c.label??'')} called={called}/>)}</section>
    <section className="mt-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-4"><p className="text-xs font-black uppercase tracking-[.18em] text-slate-500">Números chamados</p><div className="mt-3 flex flex-wrap gap-2">{Array.from(called).sort((a,b)=>a-b).map(n=><span key={n} className="grid h-9 min-w-9 place-items-center rounded-full bg-emerald-500 px-2 text-sm font-black text-slate-950">{n}</span>)}{called.size===0&&<span className="text-sm text-slate-400">O sorteio ainda não começou.</span>}</div></section>
    <div className="py-5 text-center"><button type="button" onClick={()=>window.print()} className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-black text-white print:hidden">Imprimir minha cartela</button><p className="mt-3 text-xs text-slate-600">A tela acompanha o sorteio automaticamente. A conferência oficial continua sendo feita pelo organizador ou operador.</p></div>
  </div></main>
}
function GameCard({game,cols,labels,called}:{game:PublicDigitalGame;cols:number;labels:string[];called:Set<number>}){const rows=Math.ceil(game.cells.length/cols);return <article className="rounded-2xl border border-slate-700 bg-slate-900 p-3 shadow-lg"><div className="mb-2 flex items-center justify-between"><h2 className="font-black">Jogo {game.position}</h2><span className="text-xs font-bold text-emerald-400">{markedNumbers(game.cells,called)}/{game.cells.length} marcados</span></div><div className="grid overflow-hidden rounded-xl border border-slate-700 bg-slate-800" style={{gridTemplateColumns:`repeat(${cols},minmax(0,1fr))`}}>{labels.slice(0,cols).map((label,i)=><div key={`${label}-${i}`} className="grid min-h-10 place-items-center bg-red-600 text-lg font-black">{label}</div>)}{game.cells.map((value,index)=>{const marked=value===null||called.has(value);return <div key={index} className={`grid aspect-square place-items-center border border-slate-700 text-lg font-black sm:text-xl ${marked?'bg-emerald-500 text-slate-950':'bg-white text-slate-950'}`}>{value===null?'★':String(value).padStart(2,'0')}</div>})}</div><p className="mt-2 text-right text-[10px] text-slate-500">{cols} × {rows}</p></article>}
function Badge({children,tone='neutral'}:{children:React.ReactNode;tone?:'neutral'|'warning'|'success'}){const cls=tone==='warning'?'border-amber-700 bg-amber-950/40 text-amber-300':tone==='success'?'border-emerald-700 bg-emerald-950/40 text-emerald-300':'border-slate-700 bg-slate-900 text-slate-300';return <span className={`rounded-full border px-2.5 py-1 font-bold ${cls}`}>{children}</span>}
function Shell({children}:{children:React.ReactNode}){return <main className="grid min-h-dvh place-items-center bg-slate-950 p-5 text-white"><div className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900/70 p-6">{children}</div></main>}
