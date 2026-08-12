import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const register = fs.readFileSync(path.join(root, 'src/features/auth/RegisterPage.tsx'), 'utf8')
const confirm = fs.readFileSync(path.join(root, 'src/features/auth/ConfirmEmailPage.tsx'), 'utf8')
const router = fs.readFileSync(path.join(root, 'src/app/router/AppRouter.tsx'), 'utf8')

describe('confirmação de e-mail', () => {
  it('envia o cadastro para a rota de confirmação do próprio app', () => {
    expect(register).toContain("emailRedirectTo: `${window.location.origin}/confirmar-email`")
    expect(router).toContain('path="/confirmar-email"')
  })

  it('processa PKCE ou sessão implícita e encerra a sessão antes de voltar ao login', () => {
    expect(confirm).toContain('exchangeCodeForSession(code)')
    expect(confirm).toContain('await supabase.auth.signOut()')
    expect(confirm).toContain("navigate('/entrar?emailConfirmado=1'")
  })
})
