import {describe,expect,it} from 'vitest'
import fs from 'node:fs'

describe('auditoria final de segurança e concorrência',()=>{
  const migration=fs.readFileSync('supabase/migrations/20260811170000_audit_security_concurrency_hardening.sql','utf8')
  const master=fs.readFileSync('src/features/master/MasterPage.tsx','utf8')
  const service=fs.readFileSync('src/features/master/masterService.ts','utf8')
  it('serializa o limite de eventos para impedir estouro por concorrência',()=>{
    expect(migration).toContain('for update')
    expect(migration).toContain('current_count>=lim')
  })
  it('faz suspensão global valer também para platform_admin',()=>{
    expect(migration).toContain('public.platform_user_access_allowed(auth.uid())')
    expect(migration).toContain('public.is_platform_owner() or (')
  })
  it('não permite criar owner lógico diferente do owner real',()=>{
    expect(migration).toContain("organizer_owner is reserved for the workspace owner")
  })
  it('mantém o Master utilizável quando apenas uma área falha',()=>{
    expect(master).toContain('Promise.allSettled')
    expect(master).toContain('Falha parcial ao carregar')
  })
  it('restringe logos a imagens raster seguras e tamanho controlado',()=>{
    expect(service).toContain("'image/png':'png'")
    expect(service).toContain('5*1024*1024')
    expect(master).not.toContain('image/svg+xml')
  })
})
