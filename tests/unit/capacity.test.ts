import { describe, expect, it } from 'vitest'
import { combination, physicalCardsWithoutGameReuse, uniqueGameCapacity, uniquePhysicalCompositions } from '@/domain/cards/capacity'

describe('card capacity',()=>{
  it('calculates combinations exactly',()=>{expect(combination(5,2)).toBe(10n);expect(combination(15,5)).toBe(3003n)})
  it('calculates standard 75-ball unique game capacity',()=>{
    const capacity=uniqueGameCapacity({totalBalls:75,numbersPerGame:24,distributionMode:'column_ranges',columns:[{label:'B',min:1,max:15,count:5},{label:'I',min:16,max:30,count:5},{label:'N',min:31,max:45,count:4},{label:'G',min:46,max:60,count:5},{label:'O',min:61,max:75,count:5}]})
    expect(capacity).toBe(111007923832370565n)
    expect(physicalCardsWithoutGameReuse(capacity,2)).toBe(capacity/2n)
    expect(physicalCardsWithoutGameReuse(capacity,3)).toBe(capacity/3n)
  })
  it('treats physical composition independently from no-game-reuse limit',()=>{expect(uniquePhysicalCompositions(10n,2)).toBe(45n);expect(physicalCardsWithoutGameReuse(10n,2)).toBe(5n)})
})
