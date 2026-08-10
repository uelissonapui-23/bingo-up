import {describe,expect,it} from 'vitest'
import fs from 'node:fs'

const sql=fs.readFileSync('supabase/migrations/20260810191000_fix_continuation_winner_baseline.sql','utf8')

describe('continuação de premiação não cria falsos vencedores',()=>{
  it('marca jogos completos na linha de base e remove candidatos herdados',()=>{
    expect(sql).toContain('completed_at_round_start=true')
    expect(sql).toContain('delete from public.winner_candidates where session_id=new_id')
  })
  it('só detecta vencedor quando a nova bola faz a transição para completo',()=>{
    expect(sql).toContain('coalesce(previous_missing,1)>0')
    expect(sql).toContain("not coalesce(gp.completed_at_round_start,false)")
  })
})
