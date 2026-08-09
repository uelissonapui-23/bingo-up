import {describe,expect,it} from 'vitest'
import {availableDrawNumbers,drawNumberLabel} from '@/domain/draw/board'

describe('draw board',()=>{
  it('remove números já chamados sem alterar o universo',()=>{
    expect(availableDrawNumbers(5,[2,5])).toEqual([1,3,4])
  })
  it('usa a letra da coluna quando a regra possui faixas',()=>{
    expect(drawNumberLabel(18,[{label:'B',min:1,max:15,count:5},{label:'I',min:16,max:30,count:5}])).toBe('I 18')
  })
})
