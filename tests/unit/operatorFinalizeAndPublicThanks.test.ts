import {describe,expect,it} from 'vitest'
import fs from 'node:fs'

const draw=fs.readFileSync('src/features/draw/DrawPage.tsx','utf8')
const panel=fs.readFileSync('src/features/public-panel/PublicPanelPage.tsx','utf8')
const service=fs.readFileSync('src/features/public-panel/publicPanelService.ts','utf8')
const migration=fs.readFileSync('supabase/migrations/20260813143000_operator_finalize_event_and_public_thank_you.sql','utf8')

describe('finalização pelo operador e encerramento público',()=>{
  it('oferece ao operador um encerramento definitivo com confirmação',()=>{
    expect(draw).toContain("isDrawOperator?'Finalizar todos os sorteios':'Finalizar todo o evento'")
    expect(draw).toContain('A tela pública passará a exibir a mensagem de encerramento')
    expect(migration).toContain("and not public.draw_operator_has_event_access(s.event_id)")
    expect(migration).not.toContain('draw operator cannot finalize the whole event')
  })
  it('mostra agradecimento quando o evento está finalizado',()=>{
    expect(service).toContain('event_finished: boolean')
    expect(panel).toContain('state.event_finished?<EventFinished')
    expect(panel).toContain('Obrigado pela participação!')
    expect(migration).toContain("'event_finished',ev.status='finished'")
  })
  it('redistribui cards operacionais para reduzir espaço vazio',()=>{
    expect(draw).toContain('<div className="grid gap-5 md:grid-cols-2"><Card><h2 className="text-lg font-black">Participantes congelados</h2>')
    expect(draw).toContain('Últimos chamados')
  })
})
