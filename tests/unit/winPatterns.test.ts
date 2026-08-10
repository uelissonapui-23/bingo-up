import {describe,expect,it} from 'vitest'
import {mergeWinPatterns} from '@/domain/draw/winPatterns'

describe('padrões de premiação',()=>{
  it('inclui quinas, colunas, diagonais, cantos e cartela cheia sem duplicar',()=>{
    const rows=mergeWinPatterns([{code:'full_card',name:'Cheia personalizada',kind:'full_card'}])
    const codes=rows.map(row=>row.code)
    expect(new Set(codes).size).toBe(codes.length)
    expect(codes).toContain('any_five')
    expect(codes).toContain('column_b')
    expect(codes).toContain('any_diagonal')
    expect(codes).toContain('four_corners')
    expect(rows.find(row=>row.code==='full_card')?.name).toBe('Cheia personalizada')
  })
})
