import {describe,expect,it} from 'vitest'
import fs from 'node:fs'

describe('contatos comerciais do Master',()=>{
  it('separa vendas de suporte no painel Master',()=>{
    const src=fs.readFileSync('src/features/master/MasterSupportTab.tsx','utf8')
    expect(src).toContain('Contato comercial')
    expect(src).toContain('WhatsApp de vendas')
    expect(src).toContain('WhatsApp de suporte/liberação')
  })
  it('site público usa contato comercial configurável',()=>{
    const src=fs.readFileSync('src/features/marketing/MarketingPage.tsx','utf8')
    expect(src).toContain('whatsapp_message')
    expect(src).toContain('support_phone')
  })
  it('migration mantém fallback para contato antigo',()=>{
    const sql=fs.readFileSync('supabase/migrations/20260813200000_master_commercial_contact_settings.sql','utf8')
    expect(sql).toContain('coalesce(sales_whatsapp_number,whatsapp_number)')
  })
})
