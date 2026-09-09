import fs from 'node:fs'
import {describe,expect,it} from 'vitest'

const schema=fs.readFileSync('supabase/migrations/20260909223000_complete_raffle_prize_flow.sql','utf8')+fs.readFileSync('supabase/migrations/20260909224500_allow_future_raffle_prizes.sql','utf8')
const detail=fs.readFileSync('src/features/events/EventDetailPage.tsx','utf8')
const operator=fs.readFileSync('src/features/game-modes/SpecialModeOperatorPage.tsx','utf8')
const projector=fs.readFileSync('src/features/game-modes/SpecialModeProjectorPage.tsx','utf8')

describe('fluxo completo da rifa por prêmio',()=>{
 it('vincula atomicamente um único resultado a cada prêmio e número vendido',()=>{
  expect(schema).toContain('create unique index if not exists raffle_draws_prize_unique')
  expect(schema).toContain("t.status='sold'")
  expect(schema).toContain('not exists(select 1 from public.raffle_draws d where d.ticket_id=t.id)')
  expect(schema).toContain("raise exception 'prize already drawn'")
 })
 it('mantém prêmios já sorteados imutáveis e permite acrescentar os próximos',()=>{
  expect(schema).toContain("raise exception 'cannot remove drawn prizes'")
  expect(schema).toContain('then continue')
  expect(schema).toContain("'drawn_immutable',drawn_count")
 })
 it('isola ações e painel conforme o modo do evento',()=>{
  expect(detail).toContain('Fluxo da rifa')
  expect(detail).toContain("event.game_mode==='number_bingo'&&<EventOperationalHealthCard")
  expect(operator).toContain('Prêmio que será sorteado')
  expect(projector).toContain('Ganhadores')
 })
 it('protege configuração, sorteio, entrega e consulta de preço no servidor',()=>{
  expect(schema).toContain("revoke all on function public.configure_raffle_prizes(uuid,jsonb) from public,anon")
  expect(schema).toContain("revoke all on function public.draw_raffle_prize(uuid,uuid) from public,anon")
  expect(schema).toContain("revoke all on function public.set_raffle_prize_delivered(uuid,boolean) from public,anon")
  expect(schema).toContain('public.seller_has_event_access(e.id)')
 })
})
