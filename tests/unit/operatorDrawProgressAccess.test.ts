import {describe,it,expect} from 'vitest'
import fs from 'node:fs'

const sql=fs.readFileSync('supabase/migrations/20260813130000_fix_operator_draw_progress_access.sql','utf8')

describe('acesso do operador ao progresso do sorteio',()=>{
  it('permite operador atribuido nas duas avaliacoes internas',()=>{
    expect(sql).toContain('create or replace function public.evaluate_draw_session_progress')
    expect(sql).toContain('create or replace function public.evaluate_draw_number_impact')
    expect((sql.match(/draw_operator_has_event_access\(s\.event_id\)/g)??[]).length).toBeGreaterThanOrEqual(2)
  })
  it('nao usa is_workspace_member nas avaliacoes corrigidas',()=>{
    expect(sql).not.toContain('public.is_workspace_member(s.workspace_id)')
  })
})
