import { useEffect,useState } from 'react'
import QRCode from 'qrcode'
import type { EventWithSettings } from '@/types/database'
import type { PhysicalCardView } from '@/features/cards/cardService'

type Props={card:PhysicalCardView;event:EventWithSettings;bannerUrl?:string|null}
export function PrintableCard({card,event,bannerUrl}:Props){
 const [qr,setQr]=useState<string|null>(null)
 useEffect(()=>{let alive=true;if(!card.template.show_qr_code)return;const url=`${window.location.origin}/c/${card.public_token}`;QRCode.toDataURL(url,{margin:0,width:180,errorCorrectionLevel:'M'}).then(v=>alive&&setQr(v)).catch(()=>{});return()=>{alive=false}},[card.public_token,card.template.show_qr_code])
 const template=card.template
 return <article className={`print-card print-card-${card.physical_format} ${template.orientation==='landscape'?'print-card-landscape':''}`}>
  {template.banner_position==='top'&&<Banner event={event} url={bannerUrl} showName={template.show_event_name}/>} 
  <div className={`print-games layout-${template.layout_key}`}>{card.games.map(g=><Game key={g.position} game={g.definition} position={g.position} cols={card.rule.grid_columns} labels={card.rule.column_definitions.map(c=>c.label)}/>)}</div>
  {template.banner_position==='bottom'&&<Banner event={event} url={bannerUrl} showName={template.show_event_name}/>} 
  <footer className="print-card-footer"><div><strong>{card.code}</strong>{template.show_series&&<span> · Série {card.batch.series_code}</span>}{template.show_event_date&&event.starts_at&&<span> · {new Date(event.starts_at).toLocaleDateString('pt-BR')}</span>}</div>{template.show_qr_code&&<div className="print-qr">{qr?<img src={qr} alt="QR Code da cartela"/>:<span>QR</span>}</div>}</footer>
 </article>
}
function Banner({event,url,showName}:{event:EventWithSettings;url?:string|null;showName:boolean}){return <div className="print-banner">{url&&<img src={url} alt=""/>}{showName&&<div className="print-banner-name">{event.name}</div>}</div>}
function Game({game,position,cols,labels}:{game:PhysicalCardView['games'][number]['definition'];position:number;cols:number;labels:string[]}){return <section className="print-game"><div className="print-game-title">JOGO {position}</div><div className="print-grid" style={{gridTemplateColumns:`repeat(${cols},minmax(0,1fr))`}}>{labels.length===cols&&labels.map(l=><b key={l} className="print-head">{l}</b>)}{game.cells.map((n,i)=><span key={i} className="print-cell">{n===null?'★':String(n).padStart(2,'0')}</span>)}</div></section>}
