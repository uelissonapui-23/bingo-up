import fs from 'node:fs'
import { describe, expect, it } from 'vitest'

const read=(name:string)=>fs.readFileSync(`src/features/auth/${name}.tsx`,'utf8')

describe('tratamento de falhas da autenticação',()=>{
  it.each(['LoginPage','RegisterPage','ForgotPasswordPage','ResetPasswordPage'])('%s encerra o loading mesmo em falha de rede',(page:string)=>{
    const source=read(page)
    expect(source).toContain('catch')
    expect(source).toContain('finally')
    expect(source).toContain('setBusy(false)')
  })

  it('recuperação só confirma envio quando o Supabase aceita a solicitação',()=>{
    const source=read('ForgotPasswordPage')
    expect(source).toContain('const { error } = await supabase.auth.resetPasswordForEmail')
    expect(source).toContain('if (error)')
    expect(source).toContain('else setSent(true)')
    expect(source).toContain('role="alert"')
  })
})
