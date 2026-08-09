import { useEffect,useRef,useState } from 'react'
import QRCode from 'qrcode'
import type { EventWithSettings } from '@/types/database'
import type { PhysicalCardView } from '@/features/cards/cardService'

type Props={card:PhysicalCardView;event:EventWithSettings;bannerUrl?:string|null;onReady?:(cardId:string)=>void}
export function PrintableCard({card,event,bannerUrl,onReady}:Props){
 const [qr,setQr]=useState<string|null>(null);const reported=useRef(false)
 useEffect(()=>{let alive=true;reported.current=false;const done=()=>{if(alive&&!reported.current){reported.current=true;onReady?.(card.id)}};if(!card.template.show_qr_code){done();return()=>{alive=false}}const url=`${window.location.origin}/c/${card.public_token}`;QRCode.toDataURL(url,{margin:0,width:180,errorCorrectionLevel:'M'}).then(value=>{if(alive)setQr(value)}).catch(()=>{}).finally(done);return()=>{alive=false}},[card.id,card.public_token,card.template.show_qr_code,onReady])
 const template=card.template
 return <article className={`print-card print-card-${card.physical_format} ${template.orientation==='landscape'?'print-card-landscape':''}`}>
  {template.banner_position==='top'&&<Banner event={event} url={bannerUrl} showName={template.show_event_name}/>} 
  <div className={`print-games layout-${template.layout_key}`}>{card.games.map(game=><Game key={game.position} game={game.definition} position={game.position} cols={card.rule.grid_columns} labels={card.rule.column_definitions.map(column=>column.label)}/>)}</div>
  {template.banner_position==='bottom'&&<Banner event={event} url={bannerUrl} showName={template.show_event_name}/>} 
  <footer className="print-card-footer"><div className="min-w-0 break-words"><strong>{card.code}</strong>{template.show_series&&<span> · Série {card.batch.series_code}</span>}{template.show_event_date&&event.starts_at&&<span> · {new Date(event.starts_at).toLocaleDateString('pt-BR')}</span>}</div>{template.show_qr_code&&<div className="print-qr">{qr?<img src={qr} alt="QR Code da cartela"/>:<span>QR</span>}</div>}</footer>
 </article>
}
function Banner({event,url,showName}:{event:EventWithSettings;url?:string|null;showName:boolean}){return <div className="print-banner">{url&&<img src={url} alt=""/>}{showName&&<div className="print-banner-name">{event.name}</div>}</div>}
function Game({game,position,cols,labels}:{game:PhysicalCardView['games'][number]['definition'];position:number;cols:number;labels:string[]}){return <section className="print-game"><div className="print-game-title">JOGO {position}</div><div className="print-grid" style={{gridTemplateColumns:`repeat(${cols},minmax(0,1fr))`}}>{labels.length===cols&&labels.map(label=><b key={label} className="print-head">{label}</b>)}{game.cells.map((number,index)=><span key={index} className="print-cell">{number===null?'★':String(number).padStart(2,'0')}</span>)}</div></section>}
