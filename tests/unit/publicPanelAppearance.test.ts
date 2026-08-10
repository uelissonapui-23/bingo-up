import {describe,expect,it} from 'vitest'
import {DEFAULT_PUBLIC_PANEL_APPEARANCE,normalizePublicPanelAppearance,PUBLIC_PANEL_THEME_PALETTES} from '@/domain/draw/publicPanelAppearance'
describe('aparência do painel público',()=>{
  it('mantém padrão seguro quando recebe configuração inválida',()=>{expect(normalizePublicPanelAppearance({theme:'x',victory_animation:'boom'})).toMatchObject(DEFAULT_PUBLIC_PANEL_APPEARANCE)})
  it('preserva opções válidas',()=>{expect(normalizePublicPanelAppearance({theme:'neon',board_style:'balls',victory_animation:'stars',animation_intensity:'party',show_prize:false})).toMatchObject({theme:'neon',board_style:'balls',victory_animation:'stars',animation_intensity:'party',show_prize:false})})
  it('aceita somente cores hexadecimais válidas',()=>{expect(normalizePublicPanelAppearance({use_custom_colors:true,custom_colors:{accent:'#123ABC',panel:'red',text:'#ffffff'}})).toMatchObject({use_custom_colors:true,custom_colors:{accent:'#123ABC',text:'#ffffff'}})})
  it('mantém uma paleta completa para cada tema',()=>{for(const palette of Object.values(PUBLIC_PANEL_THEME_PALETTES))expect(Object.keys(palette)).toHaveLength(9)})
})
