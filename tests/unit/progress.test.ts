import {describe,expect,it} from 'vitest'
import {prioritizeNearWinners,summarizeProgress} from '@/domain/draw/progress'

describe('summarizeProgress',()=>{
  it('conta jogos próximos e vencedores',()=>{
    expect(summarizeProgress([{missing_count:1,is_winner:false},{missing_count:1,is_winner:false},{missing_count:2,is_winner:false},{missing_count:0,is_winner:true}])).toEqual({oneAway:2,twoAway:1,winners:1,totalGames:4})
  })
})

describe('prioritizeNearWinners',()=>{
  it('mostra primeiro quem está a uma bola e limita o resultado',()=>{
    const rows=[
      {physical_card_id:'1',card_game_id:'1',position:1,missing_count:2,matched_count:3,card_code:'A-003'},
      {physical_card_id:'2',card_game_id:'2',position:2,missing_count:1,matched_count:4,card_code:'A-002'},
      {physical_card_id:'3',card_game_id:'3',position:1,missing_count:0,matched_count:5,card_code:'A-001'},
      {physical_card_id:'4',card_game_id:'4',position:1,missing_count:1,matched_count:5,card_code:'A-004'},
    ]
    expect(prioritizeNearWinners(rows,2).map(row=>row.card_code)).toEqual(['A-004','A-002'])
  })
})
