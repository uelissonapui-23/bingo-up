import type { EventWithSettings } from '@/types/database'
import type { PhysicalCardView } from '@/features/cards/cardService'
import { getCardLayoutPreset } from '@/domain/cards/layouts'
import { parseCardTemplateOptions } from '@/domain/cards/templateOptions'
import { getCardAssetUrl } from '@/features/card-config/cardConfigService'
import { WildcardSymbol } from './WildcardSymbol'

type Props={card:PhysicalCardView;event:EventWithSettings}
export function PrintableCard({card}:Props){const template=card.template,options=parseCardTemplateOptions(template.options),preset=getCardLayoutPreset(template.layout_key,Math.min(3,card.physical_format) as 1|2|3),art=options.artwork,artUrl=getCardAssetUrl(art?.path),wildcard=options.wildcard??{kind:'star',scale:1}
 return <article className="print-card print-art-card">
  {artUrl&&<img className="print-artwork" src={artUrl} alt="" style={{transform:`translate(${art?.offsetX??0}%,${art?.offsetY??0}%) scale(${art?.zoom??1})`,transformOrigin:'center'}}/>}
  {preset?.gameAreas.map((area,index)=>{const game=card.games[index];return game?<div key={game.position} className="print-game-zone" style={{left:`${area.x}%`,top:`${area.y}%`,width:`${area.width}%`,height:`${area.height}%`}}><Game game={game.definition} cols={card.rule.grid_columns} labels={card.rule.column_definitions.map(c=>c.label)} wildcard={wildcard}/></div>:null})}
 </article>}
function Game({game,cols,labels,wildcard}:{game:PhysicalCardView['games'][number]['definition'];cols:number;labels:string[];wildcard:ReturnType<typeof parseCardTemplateOptions>['wildcard']}){const safeWildcard=wildcard??{kind:'star',scale:1};return <section className="print-game"><div className="print-grid" style={{gridTemplateColumns:`repeat(${cols},minmax(0,1fr))`,gridTemplateRows:`auto repeat(${Math.ceil(game.cells.length/cols)},minmax(0,1fr))`}}>{labels.length===cols&&labels.map(l=><b key={l} className="print-head">{l}</b>)}{game.cells.map((n,i)=><span key={i} className="print-cell">{n===null?<WildcardSymbol config={safeWildcard}/>:String(n).padStart(2,'0')}</span>)}</div></section>}
