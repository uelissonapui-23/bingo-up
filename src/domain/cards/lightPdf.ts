import { getCardLayoutPreset } from './layouts'
import { parseCardTemplateOptions, type CardWildcardOptions } from './templateOptions'
import { getCardAssetUrl } from '@/features/card-config/cardConfigService'
import type { PhysicalCardView } from '@/features/cards/cardService'
import type { PrintOrientation, PrintPaper } from './imposition'
import { bestGrid, paperSpec } from './imposition'

type PdfOptions={
  cards:PhysicalCardView[]
  paper:PrintPaper
  orientation:PrintOrientation
  perSheet:number
  marginMm?:number
  gapMm?:number
  cropMarks?:boolean
  fileName:string
}

type PreparedJpeg={bytes:Uint8Array;width:number;height:number}
type PdfImageRef={name:string;objectId:number;width:number;height:number}

const PT_PER_MM=72/25.4
const enc=new TextEncoder()

export async function downloadLightweightCardsPdf(options:PdfOptions){
  if(!options.cards.length)throw new Error('Nenhuma cartela carregada para gerar o PDF.')
  const margin=options.marginMm??6,gap=options.gapMm??3
  const spec=paperSpec(options.paper,options.orientation)
  const grid=bestGrid(options.perSheet,options.paper,options.orientation,margin,gap)
  const first=options.cards[0]
  if(!first)throw new Error('Lote vazio.')
  const templateOptions=parseCardTemplateOptions(first.template.options)
  const art=templateOptions.artwork
  const backgroundUrl=getCardAssetUrl(art?.path)
  const wildcard=templateOptions.wildcard??{kind:'star',scale:1}
  const wildcardUrl=wildcard.kind==='custom'?getCardAssetUrl(wildcard.path):null
  const background=backgroundUrl?await prepareArtworkJpeg(backgroundUrl,art?.quality??'standard',art?.fit??'cover',art?.zoom??1,art?.offsetX??0,art?.offsetY??0):null
  const customWildcard=wildcardUrl?await prepareSquareJpeg(wildcardUrl):null
  const bytes=buildPdf(options.cards,{paperWidthMm:spec.width,paperHeightMm:spec.height,grid,perSheet:options.perSheet,marginMm:margin,gapMm:gap,background,customWildcard,wildcard,cropMarks:options.cropMarks??true})
  const blob=new Blob([bytes],{type:'application/pdf'})
  const url=URL.createObjectURL(blob)
  const a=document.createElement('a');a.href=url;a.download=options.fileName;a.click()
  window.setTimeout(()=>URL.revokeObjectURL(url),30_000)
  return blob.size
}

async function prepareArtworkJpeg(url:string,quality:'light'|'standard'|'high',fit:'cover'|'contain',zoom:number,offsetX:number,offsetY:number):Promise<PreparedJpeg>{
  const target=quality==='light'?{w:900,h:1273,q:.68}:quality==='high'?{w:1754,h:2480,q:.84}:{w:1240,h:1754,q:.76}
  const bitmap=await fetchBitmap(url)
  const canvas=document.createElement('canvas');canvas.width=target.w;canvas.height=target.h
  const ctx=canvas.getContext('2d',{alpha:false});if(!ctx){bitmap.close();throw new Error('Não foi possível preparar a arte para o PDF.')}
  ctx.fillStyle='#fff';ctx.fillRect(0,0,target.w,target.h)
  const baseScale=fit==='contain'?Math.min(target.w/bitmap.width,target.h/bitmap.height):Math.max(target.w/bitmap.width,target.h/bitmap.height)
  const drawW=bitmap.width*baseScale*zoom,drawH=bitmap.height*baseScale*zoom
  const x=(target.w-drawW)/2+(offsetX/100)*drawW
  const y=(target.h-drawH)/2+(offsetY/100)*drawH
  ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';ctx.drawImage(bitmap,x,y,drawW,drawH);bitmap.close()
  return canvasJpeg(canvas,target.q)
}

async function prepareSquareJpeg(url:string):Promise<PreparedJpeg>{
  const bitmap=await fetchBitmap(url),size=320
  const canvas=document.createElement('canvas');canvas.width=size;canvas.height=size
  const ctx=canvas.getContext('2d',{alpha:false});if(!ctx){bitmap.close();throw new Error('Não foi possível preparar o coringa para o PDF.')}
  ctx.fillStyle='#fff';ctx.fillRect(0,0,size,size)
  const scale=Math.min(size/bitmap.width,size/bitmap.height)*.9,w=bitmap.width*scale,h=bitmap.height*scale
  ctx.drawImage(bitmap,(size-w)/2,(size-h)/2,w,h);bitmap.close()
  return canvasJpeg(canvas,.8)
}

async function fetchBitmap(url:string){const response=await fetch(url,{cache:'force-cache'});if(!response.ok)throw new Error('Não foi possível carregar a arte da cartela.');return createImageBitmap(await response.blob())}
async function canvasJpeg(canvas:HTMLCanvasElement,quality:number):Promise<PreparedJpeg>{const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(v=>v?resolve(v):reject(new Error('Falha ao compactar imagem.')),'image/jpeg',quality));return{bytes:new Uint8Array(await blob.arrayBuffer()),width:canvas.width,height:canvas.height}}

function buildPdf(cards:PhysicalCardView[],ctx:{paperWidthMm:number;paperHeightMm:number;grid:ReturnType<typeof bestGrid>;perSheet:number;marginMm:number;gapMm:number;background:PreparedJpeg|null;customWildcard:PreparedJpeg|null;wildcard:CardWildcardOptions;cropMarks:boolean}){
  const objects:Array<Uint8Array|null>=[null]
  const reserve=()=>{objects.push(null);return objects.length-1}
  const setText=(id:number,text:string)=>{objects[id]=enc.encode(text)}
  const setBinaryStream=(id:number,dict:string,bytes:Uint8Array)=>{objects[id]=concat(enc.encode(`<< ${dict} /Length ${bytes.length} >>\nstream\n`),bytes,enc.encode('\nendstream'))}
  const catalogId=reserve(),pagesId=reserve(),fontId=reserve(),fontBoldId=reserve()
  setText(fontId,'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>')
  setText(fontBoldId,'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>')
  let bgRef:PdfImageRef|null=null,wcRef:PdfImageRef|null=null
  if(ctx.background){const id=reserve();setBinaryStream(id,`/Type /XObject /Subtype /Image /Width ${ctx.background.width} /Height ${ctx.background.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode`,ctx.background.bytes);bgRef={name:'Bg',objectId:id,width:ctx.background.width,height:ctx.background.height}}
  if(ctx.customWildcard){const id=reserve();setBinaryStream(id,`/Type /XObject /Subtype /Image /Width ${ctx.customWildcard.width} /Height ${ctx.customWildcard.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode`,ctx.customWildcard.bytes);wcRef={name:'Wc',objectId:id,width:ctx.customWildcard.width,height:ctx.customWildcard.height}}
  const pageIds:number[]=[]
  for(let start=0;start<cards.length;start+=ctx.perSheet){const pageCards=cards.slice(start,start+ctx.perSheet),contentId=reserve(),pageId=reserve();pageIds.push(pageId);const content=pageContent(pageCards,ctx,bgRef,wcRef);setBinaryStream(contentId,'',enc.encode(content));const xobjects=[bgRef,wcRef].filter((v):v is PdfImageRef=>Boolean(v)).map(v=>`/${v.name} ${v.objectId} 0 R`).join(' ');setText(pageId,`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${mm(ctx.paperWidthMm)} ${mm(ctx.paperHeightMm)}] /Resources << /Font << /F1 ${fontId} 0 R /F2 ${fontBoldId} 0 R >>${xobjects?` /XObject << ${xobjects} >>`:''} >> /Contents ${contentId} 0 R >>`)}
  setText(pagesId,`<< /Type /Pages /Kids [${pageIds.map(id=>`${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`)
  setText(catalogId,`<< /Type /Catalog /Pages ${pagesId} 0 R >>`)
  return assemblePdf(objects,catalogId)
}

function pageContent(cards:PhysicalCardView[],ctx:{paperWidthMm:number;paperHeightMm:number;grid:ReturnType<typeof bestGrid>;perSheet:number;marginMm:number;gapMm:number;wildcard:CardWildcardOptions;cropMarks:boolean},bg:PdfImageRef|null,wc:PdfImageRef|null){
  const out:string[]=['q','1 1 1 rg',`0 0 ${mm(ctx.paperWidthMm)} ${mm(ctx.paperHeightMm)} re f`,'Q']
  const usedW=ctx.grid.cols*ctx.grid.cardWidth+Math.max(0,ctx.grid.cols-1)*ctx.gapMm
  const usedH=ctx.grid.rows*ctx.grid.cardHeight+Math.max(0,ctx.grid.rows-1)*ctx.gapMm
  const startX=Math.max(ctx.marginMm,(ctx.paperWidthMm-usedW)/2)
  const startTop=Math.max(ctx.marginMm,(ctx.paperHeightMm-usedH)/2)
  cards.forEach((card,index)=>{const col=index%ctx.grid.cols,row=Math.floor(index/ctx.grid.cols);const xMm=startX+col*(ctx.grid.cardWidth+ctx.gapMm),topMm=startTop+row*(ctx.grid.cardHeight+ctx.gapMm),yMm=ctx.paperHeightMm-topMm-ctx.grid.cardHeight;drawCard(out,card,xMm,yMm,ctx.grid.cardWidth,ctx.grid.cardHeight,bg,wc,ctx.wildcard);if(ctx.cropMarks)drawCropMarks(out,xMm,yMm,ctx.grid.cardWidth,ctx.grid.cardHeight,ctx.gapMm)})
  return out.join('\n')
}

function drawCard(out:string[],card:PhysicalCardView,xMm:number,yMm:number,wMm:number,hMm:number,bg:PdfImageRef|null,wc:PdfImageRef|null,wildcard:CardWildcardOptions){
  const x=mm(xMm),y=mm(yMm),w=mm(wMm),h=mm(hMm)
  out.push('q',`${x} ${y} ${w} ${h} re W n`)
  if(bg)out.push('q',`${w} 0 0 ${h} ${x} ${y} cm /${bg.name} Do`,'Q')
  else out.push('1 1 1 rg',`${x} ${y} ${w} ${h} re f`)
  const preset=getCardLayoutPreset(card.template.layout_key,Math.min(3,card.physical_format) as 1|2|3)
  preset?.gameAreas.forEach((area,index)=>{const game=card.games[index];if(!game)return;const gx=x+w*area.x/100,gw=w*area.width/100,gh=h*area.height/100,gy=y+h*(1-(area.y+area.height)/100);drawGame(out,game.definition.cells,card.rule.grid_columns,card.rule.column_definitions.map(c=>c.label),gx,gy,gw,gh,wildcard,wc)})
  out.push('Q')
}

function drawCropMarks(out:string[],xMm:number,yMm:number,wMm:number,hMm:number,gapMm:number){
  const x=mm(xMm),y=mm(yMm),w=mm(wMm),h=mm(hMm)
  const len=mm(Math.max(1.2,Math.min(2.5,gapMm>0?gapMm*.48:1.8)))
  const inset=mm(.18)
  out.push('0.62 0.64 0.68 RG','0.32 w')
  out.push(`${x-len} ${y} m ${x-inset} ${y} l S`,`${x} ${y-len} m ${x} ${y-inset} l S`)
  out.push(`${x+w+inset} ${y} m ${x+w+len} ${y} l S`,`${x+w} ${y-len} m ${x+w} ${y-inset} l S`)
  out.push(`${x-len} ${y+h} m ${x-inset} ${y+h} l S`,`${x} ${y+h+inset} m ${x} ${y+h+len} l S`)
  out.push(`${x+w+inset} ${y+h} m ${x+w+len} ${y+h} l S`,`${x+w} ${y+h+inset} m ${x+w} ${y+h+len} l S`)
}

function drawGame(out:string[],cells:Array<number|null>,cols:number,labels:string[],x:number,y:number,w:number,h:number,wildcard:CardWildcardOptions,wc:PdfImageRef|null){
  const rows=Math.ceil(cells.length/cols),headerH=Math.min(h*.13,mm(7)),bodyH=h-headerH,cellW=w/cols,cellH=bodyH/rows
  out.push('0.98 0.98 0.98 rg',`${x} ${y} ${w} ${h} re f`,'0.08 0.10 0.14 RG','0.5 w',`${x} ${y} ${w} ${h} re S`)
  out.push('0.06 0.08 0.12 rg',`${x} ${y+h-headerH} ${w} ${headerH} re f`)
  for(let c=1;c<cols;c++){const lx=x+c*cellW;out.push('0.35 0.38 0.43 RG','0.45 w',`${lx} ${y} m ${lx} ${y+h} l S`)}
  for(let r=1;r<=rows;r++){const ly=y+r*cellH;out.push('0.35 0.38 0.43 RG','0.45 w',`${x} ${ly} m ${x+w} ${ly} l S`)}
  const headerSize=Math.max(4,Math.min(12,headerH*.48)),numberSize=Math.max(4.5,Math.min(14,cellH*.44))
  for(let c=0;c<cols;c++){const label=labels[c]??'';centerText(out,label,x+c*cellW+cellW/2,y+h-headerH/2,headerSize,true,true)}
  cells.forEach((value,i)=>{const row=Math.floor(i/cols),col=i%cols,cx=x+col*cellW+cellW/2,cy=y+bodyH-(row+.5)*cellH;if(value===null)drawWildcard(out,wildcard,wc,cx,cy,Math.min(cellW,cellH)*.42);else centerText(out,String(value).padStart(2,'0'),cx,cy,numberSize,true,false)})
}

function drawWildcard(out:string[],wildcard:CardWildcardOptions,wc:PdfImageRef|null,cx:number,cy:number,r:number){const scale=Math.max(.35,Math.min(1.8,wildcard.scale??1)),size=r*scale;if(wildcard.kind==='none')return;if(wildcard.kind==='custom'&&wc){out.push('q',`${size*2} 0 0 ${size*2} ${cx-size} ${cy-size} cm /${wc.name} Do`,'Q');return}out.push('0.9 0.08 0.08 rg','0.75 0.05 0.05 RG','0.6 w');if(wildcard.kind==='circle'||wildcard.kind==='soccer'){circle(out,cx,cy,size,true);if(wildcard.kind==='soccer'){circle(out,cx,cy,size*.34,false)}}else if(wildcard.kind==='cross'){const s=size*.85,t=size*.32;out.push(`${cx-t/2} ${cy-s} ${t} ${s*2} re f`,`${cx-s} ${cy-t/2} ${s*2} ${t} re f`)}else if(wildcard.kind==='heart'){heart(out,cx,cy,size)}else if(wildcard.kind==='fire'){flame(out,cx,cy,size)}else star(out,cx,cy,size)}
function star(out:string[],cx:number,cy:number,r:number){const pts:Array<[number,number]>=[];for(let i=0;i<10;i++){const a=Math.PI/2+i*Math.PI/5,rr=i%2===0?r:r*.42;pts.push([cx+Math.cos(a)*rr,cy+Math.sin(a)*rr])}out.push(`${pts[0]?.[0]??cx} ${pts[0]?.[1]??cy} m`,...pts.slice(1).map(p=>`${p[0]} ${p[1]} l`),'h f')}
function circle(out:string[],cx:number,cy:number,r:number,fill:boolean){const k=.5522847498*r;out.push(`${cx+r} ${cy} m`,`${cx+r} ${cy+k} ${cx+k} ${cy+r} ${cx} ${cy+r} c`,`${cx-k} ${cy+r} ${cx-r} ${cy+k} ${cx-r} ${cy} c`,`${cx-r} ${cy-k} ${cx-k} ${cy-r} ${cx} ${cy-r} c`,`${cx+k} ${cy-r} ${cx+r} ${cy-k} ${cx+r} ${cy} c`,fill?'f':'S')}
function heart(out:string[],cx:number,cy:number,r:number){out.push(`${cx} ${cy-r*.8} m`,`${cx-r*1.15} ${cy-r*.05} ${cx-r*.95} ${cy+r*.85} ${cx-r*.35} ${cy+r*.75} c`,`${cx} ${cy+r*.72} ${cx} ${cy+r*.28} ${cx} ${cy+r*.12} c`,`${cx} ${cy+r*.28} ${cx} ${cy+r*.72} ${cx+r*.35} ${cy+r*.75} c`,`${cx+r*.95} ${cy+r*.85} ${cx+r*1.15} ${cy-r*.05} ${cx} ${cy-r*.8} c`,'f')}
function flame(out:string[],cx:number,cy:number,r:number){out.push(`${cx} ${cy-r} m`,`${cx-r*.8} ${cy-r*.25} ${cx-r*.3} ${cy+r*.25} ${cx-r*.1} ${cy+r*.9} c`,`${cx+r*.55} ${cy+r*.35} ${cx+r*.85} ${cy-r*.25} ${cx} ${cy-r} c`,'f')}
function centerText(out:string[],text:string,cx:number,cy:number,size:number,bold:boolean,white:boolean){const safe=pdfString(text),estimated=text.length*size*.29;out.push('BT',white?'1 1 1 rg':'0.04 0.05 0.07 rg',`/${bold?'F2':'F1'} ${size} Tf`,`${cx-estimated} ${cy-size*.34} Td`,`(${safe}) Tj`,'ET')}
function pdfString(value:string){return value.replace(/\\/g,'\\\\').replace(/\(/g,'\\(').replace(/\)/g,'\\)').replace(/[^\x20-\x7E]/g,'')}
function mm(v:number){return +(v*PT_PER_MM).toFixed(3)}
function concat(...parts:Uint8Array[]){const len=parts.reduce((n,p)=>n+p.length,0),out=new Uint8Array(len);let offset=0;for(const p of parts){out.set(p,offset);offset+=p.length}return out}
function assemblePdf(objects:Array<Uint8Array|null>,catalogId:number){const chunks:Uint8Array[]=[enc.encode('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n')],offsets:number[]=[0];let length=chunks[0]?.length??0;for(let id=1;id<objects.length;id++){offsets[id]=length;const body=objects[id]??enc.encode('<<>>'),head=enc.encode(`${id} 0 obj\n`),tail=enc.encode('\nendobj\n');chunks.push(head,body,tail);length+=head.length+body.length+tail.length}const xrefOffset=length;let xref=`xref\n0 ${objects.length}\n0000000000 65535 f \n`;for(let id=1;id<objects.length;id++)xref+=`${String(offsets[id]).padStart(10,'0')} 00000 n \n`;const trailer=`trailer\n<< /Size ${objects.length} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;chunks.push(enc.encode(xref+trailer));return concat(...chunks)}
