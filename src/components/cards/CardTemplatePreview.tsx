import { layoutsForFormat } from '@/domain/cards/layouts'

type Props={format:1|2|3;layoutKey:string;bannerPosition:'top'|'bottom'|'none';eventName?:string}
export function CardTemplatePreview({format,layoutKey,bannerPosition,eventName='Seu evento'}:Props){
  const preset=layoutsForFormat(format).find(x=>x.key===layoutKey)
  const banner=bannerPosition==='none'?null:<div className="grid min-h-16 place-items-center rounded-xl bg-slate-900 px-3 text-center text-sm font-black text-white">BANNER · {eventName}</div>
  const games=Array.from({length:format},(_,i)=><MiniGame key={i} index={i+1}/>)
  const horizontal=layoutKey.includes('horizontal')
  const gridClass=horizontal?(format===2?'grid gap-2 sm:grid-cols-2':'grid gap-2 sm:grid-cols-3'):'grid gap-2'
  const oneTwo=layoutKey==='triple_one_two'
  return <div className="rounded-3xl border border-slate-200 bg-slate-50 p-3">
    <div className="mx-auto max-w-2xl rounded-2xl border border-slate-300 bg-white p-3 shadow-sm">
      {bannerPosition==='top'&&banner}
      <div className={`my-3 ${oneTwo?'grid grid-cols-2 gap-2':gridClass}`}>
        {oneTwo?<><div className="col-span-2">{games[0]}</div>{games.slice(1)}</>:games}
      </div>
      {bannerPosition==='bottom'&&banner}
      <div className="mt-2 flex items-center justify-between text-[10px] font-semibold text-slate-500"><span>CARTELA A-000001</span><span>QR</span></div>
    </div><p className="mt-2 text-center text-xs text-slate-500">{preset?.name ?? layoutKey}</p>
  </div>
}
function MiniGame({index}:{index:number}){return <div className="rounded-xl border border-slate-300 p-2"><div className="mb-1 text-center text-[10px] font-black text-slate-500">JOGO {index}</div><div className="grid grid-cols-5 gap-1 text-center text-[9px] font-bold"><b>B</b><b>I</b><b>N</b><b>G</b><b>O</b>{Array.from({length:25},(_,i)=><span key={i} className="rounded bg-slate-100 py-1">{i===12?'★':String((i*7)%75+1).padStart(2,'0')}</span>)}</div></div>}
