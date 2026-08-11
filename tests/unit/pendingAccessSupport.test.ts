import { describe, expect, it } from 'vitest'
import fs from 'node:fs'

describe('acesso pendente e suporte da plataforma', () => {
  const sql=fs.readFileSync('supabase/migrations/20260811180000_pending_access_support_center.sql','utf8')
  const router=fs.readFileSync('src/app/router/AppRouter.tsx','utf8')
  const service=fs.readFileSync('src/features/support/supportService.ts','utf8')

  it('bloqueia novos usuarios no banco e protege create_workspace',()=>{
    expect(sql).toContain("values(new.id,'suspended','Aguardando liberação comercial'")
    expect(sql).toContain("if not public.platform_user_access_allowed(auth.uid()) then raise exception 'Seu acesso ainda aguarda liberação da plataforma.'")
    expect(sql).toContain("coalesce((select c.access_status='active' from public.platform_user_controls c where c.user_id=target_user_id),false)")
  })

  it('mantem convites de vendedor e operador utilizaveis sem furar bloqueio manual',()=>{
    expect(sql).toContain("reason='Aguardando liberação comercial'")
    expect(sql).toContain('accept_seller_invitation')
    expect(sql).toContain('accept_draw_operator_invitation')
  })

  it('protege comprovantes e rotas operacionais',()=>{
    expect(sql).toContain("values('platform-support','platform-support',false,8388608")
    expect(sql).toContain("bucket_id='platform-support'")
    expect(router).toContain('RequirePlatformAccess')
    expect(service).toContain('createSignedUrl(path, 300)')
  })
})
