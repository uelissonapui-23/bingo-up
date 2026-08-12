import {describe,it,expect} from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
const root=process.cwd()
const read=(p:string)=>fs.readFileSync(path.join(root,p),'utf8')

describe('fluxo de autenticação preserva convites',()=>{
  it('RequireAuth mantém a rota original no parâmetro next',()=>{const s=read('src/app/guards/RequireAuth.tsx');expect(s).toContain('next=${encodeURIComponent(from)}')})
  it('cadastro leva o convite até o emailRedirectTo',()=>{const s=read('src/features/auth/RegisterPage.tsx');expect(s).toContain("confirmUrl.searchParams.set('next',next)");expect(s).toContain('emailRedirectTo:confirmUrl.toString()')})
  it('confirmação devolve o usuário ao login com o mesmo convite',()=>{const s=read('src/features/auth/ConfirmEmailPage.tsx');expect(s).toContain("login.searchParams.set('next',next)")})
  it('login retorna para o convite em vez de mandar direto à central',()=>{const s=read('src/features/auth/LoginPage.tsx');expect(s).toContain("next??'/acessos'");expect(s).toContain('authReturnQuery(next)')})
})
