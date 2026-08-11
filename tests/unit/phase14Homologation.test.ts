import { describe, expect, it } from 'vitest'
import fs from 'node:fs'

describe('fase 14 - homologacao para venda',()=>{
  const migration=fs.readFileSync('supabase/migrations/20260811190000_phase14_homologation_readiness.sql','utf8')
  const master=fs.readFileSync('src/features/master/MasterPage.tsx','utf8')
  const tab=fs.readFileSync('src/features/master/MasterHomologationTab.tsx','utf8')
  const router=fs.readFileSync('src/app/router/AppRouter.tsx','utf8')
  it('diagnostico automatico e exclusivo do Master',()=>{
    expect(migration).toContain('master_get_homologation_status')
    expect(migration).toContain("if not public.is_platform_owner()")
    expect(migration).toContain('workspaces_without_license')
    expect(migration).toContain("status='detected'")
    expect(migration).toContain("status in ('active','paused')")
    expect(migration).not.toContain("status in ('open','paused')")
  })
  it('inclui roteiro operacional completo sem remover protecoes',()=>{
    expect(master).toContain("label: 'Homologação'")
    for(const item of ['Novo cliente','Suporte','Licença','Vendedor','Operador','TV pública','Sorteio','Cartela digital','Evento completo']) expect(tab).toContain(item)
    expect(router).toContain('RequirePlatformAccess')
    expect(router).toContain('RequirePlatformOwner')
  })
  it('checklist manual nao altera banco operacional',()=>{
    expect(tab).toContain('localStorage')
    expect(tab).toContain('O progresso fica salvo apenas neste navegador Master')
  })
})
