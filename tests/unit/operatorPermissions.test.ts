import {describe,expect,it} from 'vitest'
import fs from 'node:fs'

describe('permissões do operador de sorteio',()=>{
  const migration=fs.readFileSync('supabase/migrations/20260810233100_draw_operator_access.sql','utf8')
  const shell=fs.readFileSync('src/components/layout/AppShell.tsx','utf8')
  it('mantém o operador vinculado por evento e não por workspace inteiro',()=>{
    expect(migration).toContain('event_draw_operator_assignments')
    expect(migration).toContain('draw_operator_has_event_access')
    expect(migration).toContain("operator_user_id=auth.uid()")
  })
  it('limita a edição do painel público por RPC dedicada',()=>{
    expect(migration).toContain('update_draw_operator_public_panel')
    expect(migration).toContain('public_panel_show_last_number')
    expect(migration).not.toContain('draw_operator_has_event_access(event_id) or true')
  })
  it('restringe a navegação do operador às telas de operação',()=>{
    expect(shell).toContain("currentWorkspace?.membership.role==='draw_operator'")
    expect(shell).toContain('operatorPathAllowed')
  })
})
