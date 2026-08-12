import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const register = fs.readFileSync(path.join(root, 'src/features/auth/RegisterPage.tsx'), 'utf8')
const confirm = fs.readFileSync(path.join(root, 'src/features/auth/ConfirmEmailPage.tsx'), 'utf8')
const router = fs.readFileSync(path.join(root, 'src/app/router/AppRouter.tsx'), 'utf8')

describe('confirmação de e-mail', () => {
  it('envia o cadastro para a rota de confirmação do próprio app e preserva o retorno', () => {
    expect(register).toContain("new URL('/confirmar-email',window.location.origin)")
    expect(register).toContain("confirmUrl.searchParams.set('next',next)")
    expect(register).toContain('emailRedirectTo:confirmUrl.toString()')
    expect(router).toContain('path="/confirmar-email"')
  })

  it('processa PKCE ou sessão implícita, encerra a sessão e volta ao login preservando o convite', () => {
    expect(confirm).toContain('exchangeCodeForSession(code)')
    expect(confirm).toContain('await supabase.auth.signOut()')
    expect(confirm).toContain("login.searchParams.set('emailConfirmado','1')")
    expect(confirm).toContain("if(next)login.searchParams.set('next',next)")
    expect(confirm).toContain('navigate(`${login.pathname}${login.search}`')
  })
})
