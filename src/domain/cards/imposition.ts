export type PrintPaper='A5'|'A4'|'A3'|'letter'|'legal'
export type PrintOrientation='portrait'|'landscape'
export type PaperSpec={width:number;height:number;label:string}
const PAPERS:Record<PrintPaper,PaperSpec>={A5:{width:148,height:210,label:'A5'},A4:{width:210,height:297,label:'A4'},A3:{width:297,height:420,label:'A3'},letter:{width:215.9,height:279.4,label:'Carta'},legal:{width:215.9,height:355.6,label:'Ofício / Legal'}}
export function paperSpec(paper:PrintPaper,orientation:PrintOrientation){const p=PAPERS[paper];return orientation==='portrait'?p:{...p,width:p.height,height:p.width}}
export function bestGrid(count:number,paper:PrintPaper,orientation:PrintOrientation,margin=6,gap=3){const p=paperSpec(paper,orientation);let best={cols:1,rows:count,cardWidth:0,cardHeight:0,score:0};const ratio=210/297;for(let cols=1;cols<=count;cols++){const rows=Math.ceil(count/cols),availW=p.width-margin*2-gap*(cols-1),availH=p.height-margin*2-gap*(rows-1);const w=Math.min(availW/cols,(availH/rows)*ratio),h=w/ratio,score=w*h;if(score>best.score)best={cols,rows,cardWidth:w,cardHeight:h,score}}return best}
export function allowedCardsPerSheet(paper:PrintPaper,orientation:PrintOrientation){return [1,2,3,4,6,8].filter(count=>{const g=bestGrid(count,paper,orientation);return g.cardWidth>=62&&g.cardHeight>=88})}
export function chunk<T>(items:T[],size:number){const out:T[][]=[];for(let i=0;i<items.length;i+=size)out.push(items.slice(i,i+size));return out}
