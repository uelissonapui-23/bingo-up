import { describe, expect, it } from 'vitest'
import { CARD_LAYOUT_PRESETS, layoutsForFormat } from '@/domain/cards/layouts'

describe('biblioteca de layouts', () => {
  it('mantém a quantidade oficial por formato', () => {
    expect(layoutsForFormat(1)).toHaveLength(8)
    expect(layoutsForFormat(2)).toHaveLength(10)
    expect(layoutsForFormat(3)).toHaveLength(10)
    expect(CARD_LAYOUT_PRESETS).toHaveLength(28)
  })

  it('mantém todas as áreas dentro da cartela e uma área por jogo', () => {
    for (const preset of CARD_LAYOUT_PRESETS) {
      expect(preset.gameAreas).toHaveLength(preset.format)
      for (const area of preset.gameAreas) {
        expect(area.x).toBeGreaterThanOrEqual(0)
        expect(area.y).toBeGreaterThanOrEqual(0)
        expect(area.width).toBeGreaterThan(0)
        expect(area.height).toBeGreaterThan(0)
        expect(area.x + area.width).toBeLessThanOrEqual(100)
        expect(area.y + area.height).toBeLessThanOrEqual(100)
      }
    }
  })

  it('não repete chaves de layout', () => {
    expect(new Set(CARD_LAYOUT_PRESETS.map(item => item.key)).size).toBe(CARD_LAYOUT_PRESETS.length)
  })
})
