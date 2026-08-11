import {describe,expect,it} from 'vitest'
import fs from 'node:fs'

describe('fechamento de produção',()=>{
  it('não expõe mensagem interna no error boundary',()=>{
    const source=fs.readFileSync('src/components/layout/AppErrorBoundary.tsx','utf8')
    expect(source).not.toContain('this.state.message')
  })
  it('não consulta cartela digital em aba oculta',()=>{
    const source=fs.readFileSync('src/features/cards/PublicCardPlaceholderPage.tsx','utf8')
    expect(source).toContain("document.visibilityState==='visible'")
  })
  it('mantém headers mínimos de produção',()=>{
    const config=JSON.parse(fs.readFileSync('vercel.json','utf8'))
    const all=JSON.stringify(config.headers)
    expect(all).toContain('X-Content-Type-Options')
    expect(all).toContain('Referrer-Policy')
    expect(all).toContain('Permissions-Policy')
  })
})
