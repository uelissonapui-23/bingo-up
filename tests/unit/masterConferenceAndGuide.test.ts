import {describe,expect,it} from 'vitest'
import fs from 'node:fs'

const router=fs.readFileSync('src/app/router/AppRouter.tsx','utf8')
const homolog=fs.readFileSync('src/features/master/MasterHomologationTab.tsx','utf8')
const cards=fs.readFileSync('src/features/cards/CardsPage.tsx','utf8')
const sql=fs.readFileSync('supabase/migrations/20260811210000_fix_master_homologation_conference_and_card_guide.sql','utf8')

describe('conferencia Master e gabarito',()=>{
  it('abre conferencia em rota Master independente do workspace selecionado',()=>{
    expect(router).toContain('/master/conferencia/:candidateId')
    expect(router).toContain('/master/sorteio/:sessionId')
    expect(homolog).toContain('/master/conferencia/${row.id}')
    expect(homolog).toContain('/master/sorteio/${row.session_id}')
    expect(sql).toContain('master_get_winner_candidate_conference')
    expect(sql).toContain('master_get_draw_session_diagnostic')
    expect(sql).toContain("if not public.is_platform_owner()")
  })
  it('mantem resolucao protegida e auditada no banco',()=>{
    expect(sql).toContain('master_resolve_winner_candidate')
    expect(sql).toContain("gp.missing_count<>0")
    expect(sql).toContain('winner.confirmed_by_master')
    expect(sql).toContain('winner.dismissed_by_master')
  })
  it('restaura gabarito na gestao de cartelas usando snapshot do lote',()=>{
    expect(cards).toContain('Baixar gabarito PNG')
    expect(cards).toContain('generation_options?.template_snapshot')
    expect(cards).toContain('downloadLayoutGuidePng')
  })
})
