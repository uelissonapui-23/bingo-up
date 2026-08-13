import {describe,expect,it} from 'vitest'
import {readFileSync} from 'node:fs'

describe('site público de apresentação',()=>{
  it('mantém a apresentação fora dos guards de autenticação',()=>{const router=readFileSync('src/app/router/AppRouter.tsx','utf8');expect(router).toContain('path="/apresentacao" element={<MarketingPage/>}');expect(router.indexOf('path="/apresentacao"')).toBeLessThan(router.indexOf('<Route element={<RequireAuth/>}>'))})
  it('expõe somente planos ativos e WhatsApp por RPC pública',()=>{const sql=readFileSync('supabase/migrations/20260813190000_public_marketing_site.sql','utf8');expect(sql).toContain('where p.is_active');expect(sql).toContain('grant execute on function public.get_public_marketing_data() to anon,authenticated')})
  it('possui chamadas para cadastro e login',()=>{const page=readFileSync('src/features/marketing/MarketingPage.tsx','utf8');expect(page).toContain('to="/criar-conta"');expect(page).toContain('to="/entrar"')})
})
