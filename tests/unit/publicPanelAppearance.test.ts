import {describe,expect,it} from 'vitest'
import {DEFAULT_PUBLIC_PANEL_APPEARANCE,normalizePublicPanelAppearance} from '@/domain/draw/publicPanelAppearance'
describe('aparência do painel público',()=>{
  it('mantém padrão seguro quando recebe configuração inválida',()=>{expect(normalizePublicPanelAppearance({theme:'x',victory_animation:'boom'})).toMatchObject(DEFAULT_PUBLIC_PANEL_APPEARANCE)})
  it('preserva opções válidas',()=>{expect(normalizePublicPanelAppearance({theme:'neon',board_style:'balls',victory_animation:'stars',animation_intensity:'party',show_prize:false})).toMatchObject({theme:'neon',board_style:'balls',victory_animation:'stars',animation_intensity:'party',show_prize:false})})
})
