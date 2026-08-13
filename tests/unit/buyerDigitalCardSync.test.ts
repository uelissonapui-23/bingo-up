/// <reference types="node" />
import {describe,expect,it} from 'vitest'
import fs from 'node:fs'
const migration=fs.readFileSync('supabase/migrations/20260813170000_fix_authenticated_buyer_card_sync.sql','utf8')
const page=fs.readFileSync('src/features/access/BuyerEventPage.tsx','utf8')
const router=fs.readFileSync('src/app/router/AppRouter.tsx','utf8')
describe('sincronização da cartela do comprador autenticado',()=>{
 it('usa compra concluida e email confirmado para abrir a cartela',()=>{expect(migration).toContain('email_confirmed_at');expect(migration).toContain("sa.status='completed'");expect(migration).toContain("lower(trim(coalesce(sa.buyer_email,'')))=trim(my_email)")})
 it('nao depende mais do token publico dentro da central do comprador',()=>{expect(page).toContain('/cliente/${eventId}/cartela/${c.id}');expect(router).toContain('/cliente/:eventId/cartela/:cardId')})
 it('mantem rpc privada para usuarios autenticados',()=>{expect(migration).toContain('revoke all on function public.get_my_buyer_digital_card(uuid,uuid) from public,anon');expect(migration).toContain('grant execute on function public.get_my_buyer_digital_card(uuid,uuid) to authenticated')})
})
