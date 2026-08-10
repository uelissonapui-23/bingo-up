/// <reference types="node" />
import {describe,expect,it} from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

describe('configuração de segurança de produção',()=>{
  it('não armazena respostas autenticadas do Supabase no Service Worker',()=>{
    const source=fs.readFileSync(path.resolve(process.cwd(),'vite.config.ts'),'utf8')
    expect(source).not.toContain('supabase-runtime')
    expect(source).not.toMatch(/supabase\\\.co[\\s\\S]{0,500}NetworkFirst/)
  })

  it('não expõe assinatura pública direta da tabela de sinais do painel',()=>{
    const service=fs.readFileSync(path.resolve(process.cwd(),'src/features/public-panel/publicPanelService.ts'),'utf8')
    expect(service).not.toContain("table:'public_panel_signals'")
    expect(service).not.toContain('postgres_changes')
  })
})
