import { describe, expect, it } from 'vitest'
import { canonicalGameSignature, canonicalPhysicalCardSignature } from '@/domain/cards/signature'

describe('assinaturas de cartelas', () => {
  it('considera a mesma combinação idêntica independentemente da ordem', () => {
    expect(canonicalGameSignature([7, 1, 12])).toBe(canonicalGameSignature([12, 7, 1]))
  })

  it('considera X+Y e Y+X a mesma cartela física', () => {
    expect(canonicalPhysicalCardSignature(['X', 'Y'])).toBe(canonicalPhysicalCardSignature(['Y', 'X']))
  })
})
