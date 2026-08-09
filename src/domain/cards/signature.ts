export function canonicalGameSignature(numbers: readonly number[]): string {
  const normalized = [...numbers].sort((a, b) => a - b)
  return normalized.join('-')
}

export function canonicalPhysicalCardSignature(gameSignatures: readonly string[]): string {
  return [...gameSignatures].sort().join('|')
}
