import fs from 'node:fs'
import {describe,expect,it} from 'vitest'

const app=fs.readFileSync('src/app/App.tsx','utf8')
const registration=fs.readFileSync('src/pwa/register.ts','utf8')

describe('atualização PWA em todos os papéis',()=>{
  it('exibe atualização fora do layout exclusivo do organizador',()=>{
    expect(app).toContain('<PwaStatus />')
    expect(app).toContain('<OfflineBanner />')
  })

  it('verifica novas versões periodicamente e ao voltar ao aplicativo',()=>{
    expect(registration).toContain('registration.update()')
    expect(registration).toContain("document.visibilityState === 'visible'")
  })
})
