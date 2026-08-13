import {describe,expect,it} from 'vitest'
import {readFileSync} from 'node:fs'
const panel=readFileSync('src/features/public-panel/PublicPanelPage.tsx','utf8')
const registry=readFileSync('src/features/winners/WinnerRegistryPage.tsx','utf8')
const migration=readFileSync('supabase/migrations/20260813133000_winner_registry_and_public_header_cleanup.sql','utf8')
describe('registro de ganhadores e cabeçalho da TV',()=>{
 it('separa logo, evento e rodada no cabeçalho público',()=>{expect(panel).toContain('grid-cols-[auto_minmax(0,1fr)_auto]');expect(panel).toContain('EVENTO');expect(panel).toContain('Rodada ${state.session_number}')})
 it('oferece registro de ganhadores com entrega e contatos',()=>{expect(registry).toContain('Ganhadores do evento');expect(registry).toContain('Marcar prêmio entregue');expect(registry).toContain('Chamar no WhatsApp')})
 it('protege o registro por organizador ou operador atribuído',()=>{expect(migration).toContain('draw_operator_has_event_access');expect(migration).toContain('set_winner_prize_delivery');expect(migration).toContain('get_event_winner_registry')})
})
