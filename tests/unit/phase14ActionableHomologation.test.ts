import {describe,expect,it} from 'vitest'
import fs from 'node:fs'

const sql=fs.readFileSync('supabase/migrations/20260811203000_phase14_actionable_homologation_and_final_audit.sql','utf8')
const ui=fs.readFileSync('src/features/master/MasterHomologationTab.tsx','utf8')

describe('homologação acionável e auditoria final',()=>{
  it('mantém detalhes Master somente leitura e protegidos',()=>{
    expect(sql).toContain('master_get_homologation_details')
    expect(sql).toContain("if not public.is_platform_owner()")
    expect(sql).toContain("wc.status='detected'")
    expect(sql).toContain("ds.status in ('active','paused')")
  })
  it('leva pendências operacionais para o evento correto',()=>{
    expect(ui).toContain('Abrir conferência')
    expect(ui).toContain('Abrir sorteio')
    expect(ui).toContain('/master/conferencia/${row.id}')
    expect(ui).toContain('/master/sorteio/${row.session_id}')
  })
  it('não oferece exclusão ou resolução automática pelo Master',()=>{
    expect(sql.toLowerCase()).not.toContain('delete from public.winner_candidates')
    expect(sql.toLowerCase()).not.toContain('update public.winner_candidates')
  })
})
