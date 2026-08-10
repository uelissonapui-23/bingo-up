export function normalizeCalledNumbers(values:unknown):Set<number>{
  if(!Array.isArray(values))return new Set<number>()
  return new Set(values.map(Number).filter(n=>Number.isInteger(n)&&n>0))
}
export function markedNumbers(cells:Array<number|null>,called:Set<number>){
  return cells.filter(value=>value===null||called.has(value)).length
}
