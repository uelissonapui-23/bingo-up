import { describe,expect,it } from 'vitest'
import { bestGrid,smartGrid } from '../../src/domain/cards/imposition'

describe('imposição de impressão',()=>{
  it('escolhe paisagem automaticamente para duas cartelas A4',()=>{
    const plan=smartGrid(2,'A4','auto',6,3)
    expect(plan.orientation).toBe('landscape')
    expect(plan.cols).toBe(2)
    expect(plan.rows).toBe(1)
    expect(plan.cardWidth).toBeGreaterThan(130)
  })

  it('respeita orientação manual e escolhe a melhor grade dentro do retrato',()=>{
    const plan=smartGrid(2,'A4','portrait',6,3)
    expect(plan.orientation).toBe('portrait')
    expect(plan.cols).toBe(1)
    expect(plan.rows).toBe(2)
    expect(plan.cols*plan.rows).toBeGreaterThanOrEqual(2)
  })

  it('reduz o tamanho da cartela quando o espaço de corte aumenta',()=>{
    const tight=bestGrid(4,'A4','portrait',6,0)
    const spaced=bestGrid(4,'A4','portrait',6,5)
    expect(spaced.cardWidth).toBeLessThan(tight.cardWidth)
    expect(spaced.cardHeight).toBeLessThan(tight.cardHeight)
  })
})
