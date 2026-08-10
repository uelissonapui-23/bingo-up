export const PUBLIC_PANEL_THEMES=['classic','neon','gold','party','elegant','minimal','led','colorful'] as const
export const PUBLIC_PANEL_BOARD_STYLES=['blocks','balls','led','cards','giant','compact'] as const
export const PUBLIC_PANEL_BALL_ANIMATIONS=['zoom','spin','bounce','pulse','slide','glow','none'] as const
export const PUBLIC_PANEL_VICTORY_ANIMATIONS=['confetti','gold_rain','fireworks','stars','particles','elegant','none'] as const
export const PUBLIC_PANEL_ANIMATION_INTENSITIES=['subtle','normal','party'] as const
export type PublicPanelTheme=typeof PUBLIC_PANEL_THEMES[number]
export type PublicPanelBoardStyle=typeof PUBLIC_PANEL_BOARD_STYLES[number]
export type PublicPanelBallAnimation=typeof PUBLIC_PANEL_BALL_ANIMATIONS[number]
export type PublicPanelVictoryAnimation=typeof PUBLIC_PANEL_VICTORY_ANIMATIONS[number]
export type PublicPanelAnimationIntensity=typeof PUBLIC_PANEL_ANIMATION_INTENSITIES[number]
export type PublicPanelAppearance={
  theme:PublicPanelTheme
  board_style:PublicPanelBoardStyle
  ball_animation:PublicPanelBallAnimation
  victory_animation:PublicPanelVictoryAnimation
  animation_intensity:PublicPanelAnimationIntensity
  show_round_name:boolean
  show_prize:boolean
  show_recent_numbers:boolean
  show_counters:boolean
  animated_frame:boolean
}
export const DEFAULT_PUBLIC_PANEL_APPEARANCE:PublicPanelAppearance={theme:'classic',board_style:'blocks',ball_animation:'zoom',victory_animation:'confetti',animation_intensity:'normal',show_round_name:true,show_prize:true,show_recent_numbers:true,show_counters:true,animated_frame:false}
const oneOf=<T extends readonly string[]>(value:unknown,allowed:T,fallback:T[number]):T[number]=>allowed.includes(value as T[number])?value as T[number]:fallback
export function normalizePublicPanelAppearance(value:unknown):PublicPanelAppearance{
  const raw=(value&&typeof value==='object'?value:{}) as Record<string,unknown>
  return {
    theme:oneOf(raw.theme,PUBLIC_PANEL_THEMES,DEFAULT_PUBLIC_PANEL_APPEARANCE.theme),
    board_style:oneOf(raw.board_style,PUBLIC_PANEL_BOARD_STYLES,DEFAULT_PUBLIC_PANEL_APPEARANCE.board_style),
    ball_animation:oneOf(raw.ball_animation,PUBLIC_PANEL_BALL_ANIMATIONS,DEFAULT_PUBLIC_PANEL_APPEARANCE.ball_animation),
    victory_animation:oneOf(raw.victory_animation,PUBLIC_PANEL_VICTORY_ANIMATIONS,DEFAULT_PUBLIC_PANEL_APPEARANCE.victory_animation),
    animation_intensity:oneOf(raw.animation_intensity,PUBLIC_PANEL_ANIMATION_INTENSITIES,DEFAULT_PUBLIC_PANEL_APPEARANCE.animation_intensity),
    show_round_name:typeof raw.show_round_name==='boolean'?raw.show_round_name:true,
    show_prize:typeof raw.show_prize==='boolean'?raw.show_prize:true,
    show_recent_numbers:typeof raw.show_recent_numbers==='boolean'?raw.show_recent_numbers:true,
    show_counters:typeof raw.show_counters==='boolean'?raw.show_counters:true,
    animated_frame:typeof raw.animated_frame==='boolean'?raw.animated_frame:false,
  }
}
export const PUBLIC_PANEL_THEME_LABELS:Record<PublicPanelTheme,string>={classic:'BINGOUP clássico',neon:'Neon',gold:'Dourado / Premium',party:'Festa / Confete',elegant:'Elegante',minimal:'Minimalista',led:'LED / Painel',colorful:'Colorido'}
export const PUBLIC_PANEL_BOARD_STYLE_LABELS:Record<PublicPanelBoardStyle,string>={blocks:'Blocos',balls:'Bolas circulares',led:'Painel eletrônico',cards:'Cartões',giant:'Números grandes',compact:'Grade compacta'}
export const PUBLIC_PANEL_BALL_ANIMATION_LABELS:Record<PublicPanelBallAnimation,string>={zoom:'Zoom',spin:'Giro suave',bounce:'Quicar',pulse:'Pulso',slide:'Entrada lateral',glow:'Brilho',none:'Sem animação'}
export const PUBLIC_PANEL_VICTORY_ANIMATION_LABELS:Record<PublicPanelVictoryAnimation,string>={confetti:'Confetes',gold_rain:'Chuva dourada',fireworks:'Fogos estilizados',stars:'Estrelas',particles:'Explosão de partículas',elegant:'Destaque elegante',none:'Sem animação'}
export const PUBLIC_PANEL_ANIMATION_INTENSITY_LABELS:Record<PublicPanelAnimationIntensity,string>={subtle:'Discreta',normal:'Normal',party:'Festa'}
