import fs from 'node:fs'
import {describe,expect,it} from 'vitest'

const sql=fs.readFileSync('supabase/migrations/20260810230000_stage10_sellers_and_event_permissions.sql','utf8')

describe('permissões de vendedores',()=>{
  it('exige vínculo ativo por evento',()=>{
    expect(sql).toContain('seller_has_event_access')
    expect(sql).toContain("wm.role='seller'")
    expect(sql).toContain('a.is_active')
  })
  it('não libera sorteio e motor de jogos ao vendedor',()=>{
    expect(sql).toContain('game_definitions_member_select')
    expect(sql).toContain('card_games_member_select')
    expect(sql).toContain("array['organizer_owner','organizer_admin','event_manager']")
  })
  it('registra vendas do vendedor com canal seller',()=>{
    expect(sql).toContain("'seller'::public.sale_channel")
    expect(sql).toContain('seller_user_id')
  })
})
