import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const migration=fs.readFileSync(path.resolve('supabase/migrations/20260812234500_fix_operator_workspace_audit_chain.sql'),'utf8')

describe('cadeia de permissao do operador no sorteio',()=>{
  it('permite limpeza de reservas somente para operador atribuido ao evento',()=>{
    expect(migration).toContain('public.draw_operator_has_event_access(e.id)')
    expect(migration).toContain('create or replace function public.expire_event_reservations')
  })
  it('nao usa log_audit de workspace nas funcoes operacionais do sorteio',()=>{
    expect(migration).toContain('log_event_operational_audit')
    expect(migration).not.toContain('perform public.log_audit(s.workspace_id')
    expect(migration).not.toContain('perform public.log_audit(e.workspace_id')
    expect(migration).not.toContain('perform public.log_audit(c.workspace_id')
  })
  it('mantem o helper de auditoria operacional fora da RPC publica',()=>{
    expect(migration).toContain('revoke all on function public.log_event_operational_audit(uuid,text,text,text,jsonb) from authenticated')
  })
})
