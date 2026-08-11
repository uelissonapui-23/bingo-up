import {describe,expect,it} from 'vitest'
import fs from 'node:fs'

describe('central Master organizada',()=>{
  const page=fs.readFileSync('src/features/master/MasterPage.tsx','utf8')
  const migration=fs.readFileSync('supabase/migrations/20260811150000_master_management_center.sql','utf8')
  it('separa as funcoes principais em areas claras',()=>{
    for(const label of ['Visão geral','Clientes','Usuários','Planos','Marca','Auditoria']) expect(page).toContain(label)
  })
  it('permite bloquear usuario sem bloquear o platform_owner',()=>{
    expect(migration).toContain('platform_user_controls')
    expect(migration).toContain('platform_owner cannot be suspended')
    expect(migration).toContain('platform_user_access_allowed')
  })
  it('controla planos e permissoes por workspace',()=>{
    expect(migration).toContain('commercial_plans')
    expect(migration).toContain('master_update_workspace_access_v2')
    expect(migration).toContain('master_update_membership')
  })
})
