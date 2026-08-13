/// <reference types="node" />
import {describe,expect,it} from 'vitest'
import fs from 'node:fs'

const migration=fs.readFileSync('supabase/migrations/20260813160000_final_role_isolation_hardening.sql','utf8')
const router=fs.readFileSync('src/app/router/AppRouter.tsx','utf8')
const guard=fs.readFileSync('src/app/guards/RequireEventAccess.tsx','utf8')

describe('auditoria final de isolamento entre papeis',()=>{
  it('nao permite enumerar permissao operacional de outro usuario comum',()=>{
    expect(migration).toContain("target_user_id <> auth.uid() and not public.is_platform_owner() then false")
    expect(migration).toContain('revoke all on function public.operational_user_access_allowed(uuid) from public,anon,authenticated')
  })
  it('mantem mutacoes de vinculos e controles fora do cliente direto',()=>{
    expect(migration).toContain('revoke insert,update,delete,truncate,references,trigger on table public.workspace_operational_memberships')
    expect(migration).toContain('revoke insert,update,delete,truncate,references,trigger on table public.platform_user_controls')
  })
  it('exige email confirmado para abrir compras digitais autenticadas',()=>{
    expect(migration).toContain('email_confirmed_at')
    expect(migration).toContain("raise exception 'confirmed buyer email required'")
    expect(migration).toContain("'buyer_events',case when email_confirmed is null")
  })
  it('protege tambem as rotas de evento de vendedor operador e comprador',()=>{
    expect(router).toContain('<RequireEventAccess role="seller"/>')
    expect(router).toContain('<RequireEventAccess role="operator"/>')
    expect(router).toContain('<RequireEventAccess role="buyer"/>')
    expect(guard).toContain('data.seller_events.some')
    expect(guard).toContain('data.operator_events.some')
    expect(guard).toContain('data.buyer_events.some')
  })
})
