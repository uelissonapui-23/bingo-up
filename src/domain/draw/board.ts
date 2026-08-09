import type { BingoColumnDefinition } from '@/types/database'

export function availableDrawNumbers(totalBalls:number, calledNumbers:number[]){
  const called=new Set(calledNumbers)
  return Array.from({length:totalBalls},(_,i)=>i+1).filter(n=>!called.has(n))
}

export function drawNumberLabel(number:number, columns:BingoColumnDefinition[]){
  const column=columns.find(item=>number>=item.min&&number<=item.max)
  return column ? `${column.label} ${number}` : String(number)
}

export function normalizeColumnDefinitions(value:unknown):BingoColumnDefinition[]{
  if(!Array.isArray(value)) return []
  return value.filter((item):item is BingoColumnDefinition=>{
    if(!item||typeof item!=='object') return false
    const row=item as Record<string,unknown>
    return typeof row.label==='string'&&typeof row.min==='number'&&typeof row.max==='number'&&typeof row.count==='number'
  })
}
