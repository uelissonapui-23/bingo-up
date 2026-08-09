import type { ArtworkQuality } from './templateOptions'

const QUALITY:{[K in ArtworkQuality]:{maxSide:number;quality:number}}={light:{maxSide:1800,quality:.74},standard:{maxSide:2400,quality:.84},high:{maxSide:3200,quality:.9}}

export async function optimizeArtwork(file:File,quality:ArtworkQuality):Promise<Blob>{
  if(!file.type.startsWith('image/'))throw new Error('Selecione uma imagem JPG, PNG ou WebP.')
  const bitmap=await createImageBitmap(file)
  const profile=QUALITY[quality]
  const factor=Math.min(1,profile.maxSide/Math.max(bitmap.width,bitmap.height))
  const width=Math.max(1,Math.round(bitmap.width*factor));const height=Math.max(1,Math.round(bitmap.height*factor))
  const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height
  const ctx=canvas.getContext('2d',{alpha:true});if(!ctx)throw new Error('Não foi possível preparar a imagem.')
  ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';ctx.drawImage(bitmap,0,0,width,height);bitmap.close()
  return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('Falha ao otimizar a arte.')),'image/webp',profile.quality))
}

export async function optimizeWildcard(file:File):Promise<Blob>{
  if(!file.type.startsWith('image/'))throw new Error('Selecione uma imagem válida para o coringa.')
  const bitmap=await createImageBitmap(file);const factor=Math.min(1,512/Math.max(bitmap.width,bitmap.height));const width=Math.max(1,Math.round(bitmap.width*factor));const height=Math.max(1,Math.round(bitmap.height*factor))
  const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const ctx=canvas.getContext('2d',{alpha:true});if(!ctx)throw new Error('Não foi possível preparar o coringa.')
  ctx.drawImage(bitmap,0,0,width,height);bitmap.close();return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('Falha ao otimizar o coringa.')),'image/webp',.86))
}

export function downloadLayoutGuidePng(layoutKey:string,format:1|2|3,areas:Array<{x:number;y:number;width:number;height:number}>) {
  const width=1240,height=1754
  const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const ctx=canvas.getContext('2d');if(!ctx)return
  ctx.fillStyle='#ffffff';ctx.fillRect(0,0,width,height);ctx.strokeStyle='#111827';ctx.lineWidth=4;ctx.strokeRect(2,2,width-4,height-4)
  ctx.font='700 28px Arial';ctx.textAlign='center';ctx.textBaseline='middle'
  areas.forEach((area,index)=>{const x=area.x/100*width,y=area.y/100*height,w=area.width/100*width,h=area.height/100*height;ctx.fillStyle='rgba(239,68,68,.09)';ctx.fillRect(x,y,w,h);ctx.strokeStyle='#dc2626';ctx.lineWidth=4;ctx.setLineDash([18,12]);ctx.strokeRect(x,y,w,h);ctx.setLineDash([]);ctx.fillStyle='#991b1b';ctx.fillText(`JOGO ${index+1} — ÁREA DOS NÚMEROS`,x+w/2,y+h/2)})
  const a=document.createElement('a');a.download=`gabarito-${format}em1-${layoutKey}.png`;a.href=canvas.toDataURL('image/png');a.click()
}
