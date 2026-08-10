import {describe,expect,it} from 'vitest'
import {markedNumbers,normalizeCalledNumbers} from '../../src/domain/cards/publicDigitalCard'

describe('cartela digital pública',()=>{
  it('normaliza apenas pedras válidas',()=>{expect([...normalizeCalledNumbers([1,'2',null,-3,'x',2])]).toEqual([1,2])})
  it('marca pedras chamadas e coringa',()=>{expect(markedNumbers([1,2,null,4,5],new Set([2,5]))).toBe(3)})
})
