import { canonicalGameSignature, canonicalPhysicalCardSignature } from './signature'
import type { BingoRuleSet } from '@/types/database'

export type RandomSource = () => number
export type GeneratedGame = {
  signature: string
  numbers: number[]
  cells: Array<number | null>
}
export type GeneratedPhysicalCard = {
  sequenceNumber: number
  code: string
  compositionSignature: string
  games: Array<GeneratedGame & { position: number }>
}

export type GenerationPlan = {
  requestedCards: number
  gamesPerCard: number
  totalGameSlots: number
  remainingUniqueGames: bigint
  strictCardLimit: bigint
  controlledCardLimit: bigint | null
  repeatedGamesRequired: bigint
  uniqueGamesRequired: bigint
  canGenerateStrict: boolean
  canGenerateControlled: boolean
}

export function buildGenerationPlan(input: {
  requestedCards: number
  gamesPerCard: number
  remainingUniqueGames: bigint
  existingUniqueGames?: bigint
}): GenerationPlan {
  const requestedCards = Math.max(0, Math.trunc(input.requestedCards))
  const gamesPerCard = Math.max(1, Math.trunc(input.gamesPerCard))
  const cards = BigInt(requestedCards)
  const format = BigInt(gamesPerCard)
  const slots = cards * format
  const remaining = input.remainingUniqueGames < 0n ? 0n : input.remainingUniqueGames
  const strictLimit = remaining / format
  const controlledLimit = gamesPerCard === 1 ? null : remaining / BigInt(gamesPerCard - 1)
  const existing = input.existingUniqueGames ?? 0n
  const uniqueRequired = slots <= remaining ? slots : remaining
  const repeats = slots > remaining ? slots - remaining : 0n
  return {
    requestedCards,
    gamesPerCard,
    totalGameSlots: requestedCards * gamesPerCard,
    remainingUniqueGames: remaining,
    strictCardLimit: strictLimit,
    controlledCardLimit: controlledLimit,
    repeatedGamesRequired: repeats,
    uniqueGamesRequired: uniqueRequired,
    canGenerateStrict: cards <= strictLimit,
    canGenerateControlled: gamesPerCard === 1 ? (remaining + existing > 0n) : (cards <= controlledLimit! && (cards === 0n || slots <= remaining || existing > 0n || remaining >= format)),
  }
}

function cryptoRandom(): number {
  const values = new Uint32Array(1)
  globalThis.crypto.getRandomValues(values)
  return values[0]! / 0x1_0000_0000
}

function sampleRange(min: number, max: number, count: number, random: RandomSource): number[] {
  if (count < 0 || max < min || count > max - min + 1) throw new Error('Faixa inválida para geração.')
  const values = Array.from({ length: max - min + 1 }, (_, i) => min + i)
  for (let i = values.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1))
    const current = values[i]!
    values[i] = values[j]!
    values[j] = current
  }
  return values.slice(0, count).sort((a, b) => a - b)
}

function cellsFromAny(rule: BingoRuleSet, numbers: number[]): Array<number | null> {
  const cellCount = rule.grid_rows * rule.grid_columns
  const cells: Array<number | null> = Array(cellCount).fill(null)
  const freeIndex = rule.free_center ? Math.floor(rule.grid_rows / 2) * rule.grid_columns + Math.floor(rule.grid_columns / 2) : -1
  let n = 0
  for (let i = 0; i < cellCount; i += 1) {
    if (i === freeIndex) continue
    cells[i] = numbers[n++] ?? null
  }
  return cells
}

function cellsFromColumns(rule: BingoRuleSet, perColumn: number[][]): Array<number | null> {
  if (perColumn.length !== rule.grid_columns) throw new Error('A regra por colunas precisa definir uma faixa para cada coluna.')
  const cells: Array<number | null> = Array(rule.grid_rows * rule.grid_columns).fill(null)
  const freeRow = rule.free_center ? Math.floor(rule.grid_rows / 2) : -1
  const freeColumn = rule.free_center ? Math.floor(rule.grid_columns / 2) : -1
  for (let column = 0; column < rule.grid_columns; column += 1) {
    const availableRows = Array.from({ length: rule.grid_rows }, (_, r) => r).filter(r => !(r === freeRow && column === freeColumn))
    const columnValues = perColumn[column]!
    if (columnValues.length !== availableRows.length) {
      throw new Error(`A coluna ${column + 1} precisa de ${availableRows.length} números para preencher a grade.`)
    }
    for (let i = 0; i < availableRows.length; i += 1) {
      const row = availableRows[i]!
      cells[row * rule.grid_columns + column] = columnValues[i] ?? null
    }
  }
  return cells
}

export function generateRandomGame(rule: BingoRuleSet, random: RandomSource = cryptoRandom): GeneratedGame {
  if (rule.distribution_mode === 'any') {
    const numbers = sampleRange(1, rule.total_balls, rule.numbers_per_game, random)
    return { numbers, signature: canonicalGameSignature(numbers), cells: cellsFromAny(rule, numbers) }
  }
  const definitions = rule.column_definitions
  if (definitions.length !== rule.grid_columns) throw new Error('As faixas por coluna não correspondem ao número de colunas da grade.')
  const perColumn = definitions.map(column => sampleRange(column.min, column.max, column.count, random))
  const numbers = perColumn.flat().sort((a, b) => a - b)
  if (numbers.length !== rule.numbers_per_game) throw new Error('A regra gerou quantidade incorreta de números.')
  return { numbers, signature: canonicalGameSignature(numbers), cells: cellsFromColumns(rule, perColumn) }
}

export function createUniqueGames(input: {
  rule: BingoRuleSet
  count: number
  forbiddenSignatures: Set<string>
  random?: RandomSource
  maxAttemptsPerGame?: number
}): GeneratedGame[] {
  const result: GeneratedGame[] = []
  const seen = new Set(input.forbiddenSignatures)
  const random = input.random ?? cryptoRandom
  const maxAttempts = Math.max(100, input.maxAttemptsPerGame ?? 5000)
  for (let index = 0; index < input.count; index += 1) {
    let accepted: GeneratedGame | null = null
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const candidate = generateRandomGame(input.rule, random)
      if (!seen.has(candidate.signature)) { accepted = candidate; break }
    }
    if (!accepted) throw new Error('Não foi possível encontrar outra combinação inédita com segurança. Reduza a quantidade ou use repetição controlada.')
    seen.add(accepted.signature)
    result.push(accepted)
  }
  return result
}

export function composePhysicalCards(input: {
  uniqueGames: GeneratedGame[]
  repeatPool: GeneratedGame[]
  requestedCards: number
  gamesPerCard: number
  repeatsRequired: number
  seriesCode: string
  startNumber: number
  codePadding: number
  forbiddenCompositionSignatures?: Set<string>
  random?: RandomSource
}): GeneratedPhysicalCard[] {
  const random = input.random ?? cryptoRandom
  const uniqueQueue = [...input.uniqueGames]
  const availableRepeats = [...input.repeatPool]
  const compositions = new Set(input.forbiddenCompositionSignatures ?? [])
  const cards: GeneratedPhysicalCard[] = []
  let repeatsLeft = Math.max(0, input.repeatsRequired)

  for (let cardIndex = 0; cardIndex < input.requestedCards; cardIndex += 1) {
    const cardsLeftIncludingCurrent = input.requestedCards - cardIndex
    const repeatIsMandatoryNow = repeatsLeft >= cardsLeftIncludingCurrent
    const canRepeatNow = availableRepeats.length > 0
    const shouldRepeat = repeatsLeft > 0 && canRepeatNow && (repeatIsMandatoryNow || uniqueQueue.length < input.gamesPerCard)
    const repeatedOnCard = shouldRepeat ? 1 : 0
    const uniqueNeeded = input.gamesPerCard - repeatedOnCard
    if (uniqueQueue.length < uniqueNeeded) throw new Error('Não existem jogos inéditos suficientes para respeitar o limite de uma repetição por cartela.')

    let built: GeneratedGame[] | null = null
    let usedUnique: GeneratedGame[] = []
    for (let attempt = 0; attempt < 300; attempt += 1) {
      const uniquePart = uniqueQueue.slice(0, uniqueNeeded)
      let repeatPart: GeneratedGame[] = []
      if (repeatedOnCard) {
        const forbidden = new Set(uniquePart.map(g => g.signature))
        const candidates = availableRepeats.filter(g => !forbidden.has(g.signature))
        if (!candidates.length) throw new Error('Não existe jogo previamente emitido disponível para a repetição controlada desta cartela.')
        repeatPart = [candidates[Math.floor(random() * candidates.length)]!]
      }
      const candidate = [...uniquePart, ...repeatPart]
      const signature = canonicalPhysicalCardSignature(candidate.map(g => g.signature))
      if (!compositions.has(signature) || input.gamesPerCard === 1) { built = candidate; usedUnique = uniquePart; break }
      if (uniqueQueue.length > uniqueNeeded) {
        const swapIndex = uniqueNeeded + Math.floor(random() * (uniqueQueue.length - uniqueNeeded))
        const lastUniqueIndex = uniqueNeeded - 1
        const current = uniqueQueue[lastUniqueIndex]!
        uniqueQueue[lastUniqueIndex] = uniqueQueue[swapIndex]!
        uniqueQueue[swapIndex] = current
      }
    }
    if (!built) throw new Error('Não foi possível montar uma composição física inédita. Tente novamente ou reduza a quantidade.')
    uniqueQueue.splice(0, uniqueNeeded)
    availableRepeats.push(...usedUnique)
    if (repeatedOnCard) repeatsLeft -= 1
    const compositionSignature = canonicalPhysicalCardSignature(built.map(g => g.signature))
    compositions.add(compositionSignature)
    const sequenceNumber = input.startNumber + cardIndex
    cards.push({
      sequenceNumber,
      code: `${input.seriesCode}-${String(sequenceNumber).padStart(input.codePadding, '0')}`,
      compositionSignature,
      games: built.map((game, position) => ({ ...game, position: position + 1 })),
    })
  }
  if (repeatsLeft !== 0) throw new Error('O plano de repetição controlada não pôde ser distribuído corretamente.')
  return cards
}
