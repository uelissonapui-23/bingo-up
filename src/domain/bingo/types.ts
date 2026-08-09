export type BingoFormat = 1 | 2 | 3

export type DrawState = 'active' | 'paused' | 'finished' | 'canceled'

export type PublicPanelSnapshot = {
  currentNumber: number | null
  calledNumbers: number[]
  totalNumbers: number
  oneAwayCount: number
  twoAwayCount: number
  possibleWinner: boolean
}
