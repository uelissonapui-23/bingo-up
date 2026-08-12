import { describe, expect, it } from 'vitest'
import { DEFAULT_GAME_STYLE, parseCardTemplateOptions } from '../../src/domain/cards/templateOptions'

const thematic=['star','circle','heart','cross','fire','soccer','diamond','square','triangle','sun','moon','clover','flower','bolt','check','xmark','crown','target','ring','sparkle'] as const

describe('coringa e transparência das cartelas',()=>{
  it('mantém pelo menos 20 coringas temáticos válidos',()=>{
    expect(thematic).toHaveLength(20)
    for(const kind of thematic)expect(parseCardTemplateOptions({wildcard:{kind,scale:1}}).wildcard?.kind).toBe(kind)
  })
  it('normaliza opacidade do fundo dos números entre 0 e 1',()=>{
    expect(parseCardTemplateOptions({gameStyle:{...DEFAULT_GAME_STYLE,cellBackgroundOpacity:0}}).gameStyle?.cellBackgroundOpacity).toBe(0)
    expect(parseCardTemplateOptions({gameStyle:{...DEFAULT_GAME_STYLE,cellBackgroundOpacity:.55}}).gameStyle?.cellBackgroundOpacity).toBe(.55)
    expect(parseCardTemplateOptions({gameStyle:{...DEFAULT_GAME_STYLE,cellBackgroundOpacity:4}}).gameStyle?.cellBackgroundOpacity).toBe(1)
  })
})
