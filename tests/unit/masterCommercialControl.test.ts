import {describe,expect,it} from 'vitest'
import fs from 'node:fs'

describe('controle comercial Master',()=>{
  const migration=fs.readFileSync('supabase/migrations/20260811120000_stage13_master_commercial_control.sql','utf8')
  const router=fs.readFileSync('src/app/router/AppRouter.tsx','utf8')
  it('protege o Master por platform_owner',()=>{
    expect(migration).toContain("role='platform_owner'")
    expect(router).toContain('RequirePlatformOwner')
    expect(router).toContain('path="/master"')
  })
  it('aplica limite de eventos no banco',()=>{
    expect(migration).toContain('enforce_workspace_event_license')
    expect(migration).toContain('event_limit')
    expect(migration).toContain('Limite de eventos da licença atingido')
  })
  it('restringe escrita de branding ao Master',()=>{
    expect(migration).toContain("bucket_id='platform-branding' and public.is_platform_owner()")
    expect(migration).toContain('master_update_platform_branding')
  })
})
