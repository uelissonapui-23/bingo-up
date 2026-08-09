import { describe, expect, it } from 'vitest'
import { buildGenerationPlan, composePhysicalCards, createUniqueGames } from '../../src/domain/cards/generator'
import type { BingoRuleSet } from '../../src/types/database'

const rule: BingoRuleSet = {
  id:'r',workspace_id:'w',event_id:'e',name:'Mini',code:'mini',total_balls:6,grid_rows:2,grid_columns:2,numbers_per_game:4,free_center:false,
  distribution_mode:'any',column_definitions:[],win_patterns:[],is_default:true,is_active:true,locked_at:null,created_by:null,created_at:'',updated_at:''
}

describe('generation plan',()=>{
  it('separa limite estrito do limite controlado',()=>{
    const plan=buildGenerationPlan({requestedCards:4,gamesPerCard:2,remainingUniqueGames:7n})
    expect(plan.strictCardLimit).toBe(3n)
    expect(plan.controlledCardLimit).toBe(7n)
    expect(plan.canGenerateStrict).toBe(false)
    expect(plan.canGenerateControlled).toBe(true)
    expect(plan.repeatedGamesRequired).toBe(1n)
  })
})

describe('card generation',()=>{
  it('não repete assinatura ao gerar jogos inéditos',()=>{
    let n=0
    const random=()=>((n++*0.173)%1)
    const games=createUniqueGames({rule,count:5,forbiddenSignatures:new Set(),random,maxAttemptsPerGame:1000})
    expect(new Set(games.map(g=>g.signature)).size).toBe(5)
  })
  it('permite no máximo um jogo repetido em 3 em 1',()=>{
    let n=0
    const random=()=>((n++*0.193)%1)
    const unique=createUniqueGames({rule,count:5,forbiddenSignatures:new Set(),random,maxAttemptsPerGame:1000})
    const cards=composePhysicalCards({uniqueGames:unique,repeatPool:[],requestedCards:2,gamesPerCard:3,repeatsRequired:1,seriesCode:'A',startNumber:1,codePadding:4,random})
    expect(cards).toHaveLength(2)
    expect(cards.every(card=>new Set(card.games.map(g=>g.signature)).size===3)).toBe(true)
    expect(new Set(cards.map(card=>card.compositionSignature)).size).toBe(2)
  })
})
