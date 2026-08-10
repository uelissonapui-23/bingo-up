import {describe,expect,it} from 'vitest'
import {buildPublicBoardColumns,recentCalledNumbers} from '../../src/domain/draw/publicBoard'

describe('painel público',()=>{
  it('distribui 75 bolas nas cinco colunas BINGO',()=>{
    const columns=buildPublicBoardColumns(75)
    expect(columns.map(column=>column.label)).toEqual(['B','I','N','G','O'])
    expect(columns[0]!.numbers).toEqual(Array.from({length:15},(_,i)=>i+1))
    expect(columns[4]!.numbers).toEqual(Array.from({length:15},(_,i)=>i+61))
  })
  it('mantém os chamados mais recentes primeiro',()=>{
    expect(recentCalledNumbers([4,18,33,51,72],3)).toEqual([72,51,33])
  })
})
