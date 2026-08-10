export type PublicBoardColumn={label:string;numbers:number[]}
const BINGO_LABELS=['B','I','N','G','O'] as const

export function buildPublicBoardColumns(totalBalls:number):PublicBoardColumn[]{
  const safeTotal=Math.max(0,Math.floor(totalBalls||0))
  const perColumn=Math.ceil(safeTotal/BINGO_LABELS.length)
  return BINGO_LABELS.map((label,index)=>{
    const start=index*perColumn+1
    const end=Math.min(safeTotal,(index+1)*perColumn)
    const numbers=start>safeTotal?[]:Array.from({length:end-start+1},(_,i)=>start+i)
    return {label,numbers}
  })
}

export function recentCalledNumbers(numbers:number[],limit=8){
  return numbers.slice(-Math.max(0,limit)).reverse()
}
