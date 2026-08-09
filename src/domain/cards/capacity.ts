export type ColumnDefinition = { label: string; min: number; max: number; count: number }

export function combination(n: number | bigint, k: number | bigint): bigint {
  const nn = BigInt(n); let kk = BigInt(k)
  if (kk < 0n || nn < 0n || kk > nn) return 0n
  if (kk > nn - kk) kk = nn - kk
  let result = 1n
  for (let i = 1n; i <= kk; i += 1n) result = (result * (nn - kk + i)) / i
  return result
}

export function uniqueGameCapacity(input: {
  totalBalls: number
  numbersPerGame: number
  distributionMode: 'any' | 'column_ranges'
  columns?: ColumnDefinition[]
}): bigint {
  if (input.distributionMode === 'any') return combination(input.totalBalls, input.numbersPerGame)
  const definitions = input.columns ?? []
  if (!definitions.length) return 0n
  return definitions.reduce((acc, column) => {
    const range = column.max - column.min + 1
    return acc * combination(range, column.count)
  }, 1n)
}

export function physicalCardsWithoutGameReuse(uniqueGames: bigint, gamesPerPhysicalCard: number): bigint {
  if (gamesPerPhysicalCard < 1) return 0n
  return uniqueGames / BigInt(gamesPerPhysicalCard)
}

export function uniquePhysicalCompositions(uniqueGames: bigint, gamesPerPhysicalCard: number): bigint {
  return combination(uniqueGames, BigInt(gamesPerPhysicalCard))
}

export function formatBigInt(value: bigint): string {
  return value.toLocaleString('pt-BR')
}
