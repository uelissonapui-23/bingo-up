import {describe,expect,it} from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const root=process.cwd()
const migration=fs.readFileSync(path.join(root,'supabase/migrations/20260812232000_fix_invited_operator_draw_access.sql'),'utf8')
const service=fs.readFileSync(path.join(root,'src/features/draw/drawService.ts'),'utf8')

describe('acesso de sorteio por operador convidado',()=>{
  it('não bloqueia conta legada apenas por não possuir platform_user_controls',()=>{
    expect(migration).toContain('coalesce(')
    expect(migration).toContain('true\n    );')
    expect(migration).toContain('draw_operator_has_event_access')
    expect(migration).toContain("m.role='draw_operator'")
    expect(migration).toContain('public.workspace_license_active(a.workspace_id)')
  })

  it('mantém bloqueios explícitos e exceções operacionais de convite',()=>{
    expect(migration).toContain("c.access_status='active'")
    expect(migration).toContain("'Aguardando liberação comercial'")
    expect(migration).toContain("'Acesso operacional por convite; licença de organizador não liberada'")
  })

  it('expõe a mensagem real do Supabase ao iniciar a rodada',()=>{
    expect(service).toContain("throw new Error(error.message||'Não foi possível iniciar o sorteio.')")
  })
})
