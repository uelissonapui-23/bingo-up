import fs from 'node:fs'
import {describe,expect,it} from 'vitest'

const migration=fs.readFileSync('supabase/migrations/20260909213000_fix_special_mode_operational_audit_chain.sql','utf8')

describe('auditoria operacional dos modos especiais',()=>{
  it('aceita somente papéis autorizados no evento',()=>{
    expect(migration).toContain('public.seller_has_event_access(e.id)')
    expect(migration).toContain('public.draw_operator_has_event_access(e.id)')
    expect(migration).toContain('revoke all on function public.log_special_game_audit')
  })

  it('não chama o log legado que bloqueava vendedores e operadores',()=>{
    expect(migration).toContain("perform public.log_special_game_audit(e.id,'raffle.ticket_'")
    expect(migration).toContain("perform public.log_special_game_audit(e.id,'symbol_bingo.card_'")
    expect(migration).not.toContain('perform public.log_audit')
  })

  it('impede que uma troca de tema deixe cartelas órfãs',()=>{
    expect(migration).toContain('cannot change symbols after cards are generated')
  })
})
