export type CardLayoutPreset = {
  key: string
  format: 1 | 2 | 3
  name: string
  description: string
  orientation: 'portrait' | 'landscape'
}

export const CARD_LAYOUT_PRESETS: CardLayoutPreset[] = [
  { key: 'single_classic', format: 1, name: 'Clássico', description: 'Banner superior e um jogo central grande.', orientation: 'portrait' },
  { key: 'single_compact', format: 1, name: 'Compacto', description: 'Mais espaço para informações do evento.', orientation: 'portrait' },
  { key: 'single_banner_large', format: 1, name: 'Banner grande', description: 'Destaque maior para a identidade do evento.', orientation: 'portrait' },
  { key: 'double_vertical', format: 2, name: 'Vertical', description: 'Dois jogos empilhados.', orientation: 'portrait' },
  { key: 'double_horizontal', format: 2, name: 'Horizontal', description: 'Dois jogos lado a lado.', orientation: 'landscape' },
  { key: 'double_compact', format: 2, name: 'Compacto', description: 'Dois jogos compactos com cabeçalho enxuto.', orientation: 'portrait' },
  { key: 'triple_horizontal', format: 3, name: 'Três lado a lado', description: 'Três jogos em linha para impressão horizontal.', orientation: 'landscape' },
  { key: 'triple_vertical', format: 3, name: 'Três empilhados', description: 'Três jogos em coluna.', orientation: 'portrait' },
  { key: 'triple_one_two', format: 3, name: '1 + 2', description: 'Um jogo superior e dois inferiores.', orientation: 'portrait' },
]

export function layoutsForFormat(format: 1 | 2 | 3) {
  return CARD_LAYOUT_PRESETS.filter((item) => item.format === format)
}
