export type PrintPaper='A5'|'A4'|'A3'|'letter'|'legal'
export type PrintOrientation='portrait'|'landscape'
export type PrintOrientationMode=PrintOrientation|'auto'
export type PaperSpec={width:number;height:number;label:string}
export type GridPlan={cols:number;rows:number;cardWidth:number;cardHeight:number;score:number}
export type SmartGridPlan=GridPlan&{orientation:PrintOrientation}

const PAPERS:Record<PrintPaper,PaperSpec>={
  A5:{width:148,height:210,label:'A5'},
  A4:{width:210,height:297,label:'A4'},
  A3:{width:297,height:420,label:'A3'},
  letter:{width:215.9,height:279.4,label:'Carta'},
  legal:{width:215.9,height:355.6,label:'Ofício / Legal'},
}

const CARD_RATIO=210/297

export function paperSpec(paper:PrintPaper,orientation:PrintOrientation){
  const p=PAPERS[paper]
  return orientation==='portrait'?p:{...p,width:p.height,height:p.width}
}

export function bestGrid(count:number,paper:PrintPaper,orientation:PrintOrientation,margin=6,gap=3):GridPlan{
  const p=paperSpec(paper,orientation)
  let best:GridPlan={cols:1,rows:Math.max(1,count),cardWidth:0,cardHeight:0,score:0}
  for(let cols=1;cols<=count;cols++){
    const rows=Math.ceil(count/cols)
    const availW=p.width-margin*2-gap*(cols-1)
    const availH=p.height-margin*2-gap*(rows-1)
    if(availW<=0||availH<=0)continue
    const w=Math.min(availW/cols,(availH/rows)*CARD_RATIO)
    const h=w/CARD_RATIO
    const area=w*h
    const capacity=cols*rows
    const occupancy=count/capacity
    const cutFriendly=capacity===count?1:Math.pow(occupancy,1.35)
    const score=area*cutFriendly
    const betterScore=score>best.score+.0001
    const tieAndWider=Math.abs(score-best.score)<=.0001&&cols>best.cols
    if(betterScore||tieAndWider)best={cols,rows,cardWidth:w,cardHeight:h,score}
  }
  return best
}

export function smartGrid(count:number,paper:PrintPaper,orientation:PrintOrientationMode='auto',margin=6,gap=3):SmartGridPlan{
  if(orientation!=='auto')return{...bestGrid(count,paper,orientation,margin,gap),orientation}
  const portrait={...bestGrid(count,paper,'portrait',margin,gap),orientation:'portrait' as const}
  const landscape={...bestGrid(count,paper,'landscape',margin,gap),orientation:'landscape' as const}
  if(landscape.score>portrait.score+.0001)return landscape
  if(portrait.score>landscape.score+.0001)return portrait
  if(landscape.cardWidth>portrait.cardWidth+.0001)return landscape
  return portrait
}

export function allowedCardsPerSheet(paper:PrintPaper,orientation:PrintOrientationMode='auto',margin=6,gap=3){
  return [1,2,3,4,6,8].filter(count=>{
    const g=smartGrid(count,paper,orientation,margin,gap)
    return g.cardWidth>=62&&g.cardHeight>=88
  })
}

export function chunk<T>(items:T[],size:number){
  const out:T[][]=[]
  for(let i=0;i<items.length;i+=size)out.push(items.slice(i,i+size))
  return out
}
