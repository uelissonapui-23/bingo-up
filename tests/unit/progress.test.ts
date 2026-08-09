import {describe,expect,it} from 'vitest'
import {summarizeProgress} from '@/domain/draw/progress'
describe('summarizeProgress',()=>{it('conta jogos próximos e vencedores',()=>{expect(summarizeProgress([{missing_count:1,is_winner:false},{missing_count:1,is_winner:false},{missing_count:2,is_winner:false},{missing_count:0,is_winner:true}])).toEqual({oneAway:2,twoAway:1,winners:1,totalGames:4})})})
