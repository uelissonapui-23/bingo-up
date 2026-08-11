export const PUBLIC_PANEL_THEMES=['classic','neon','gold','party','elegant','minimal','led','colorful'] as const
export const PUBLIC_PANEL_BOARD_STYLES=['blocks','balls','led','cards','giant','compact'] as const
export const PUBLIC_PANEL_BALL_ANIMATIONS=['zoom','spin','bounce','pulse','slide','glow','none'] as const
export const PUBLIC_PANEL_VICTORY_ANIMATIONS=['confetti','gold_rain','fireworks','stars','particles','elegant','none'] as const
export const PUBLIC_PANEL_ANIMATION_INTENSITIES=['subtle','normal','party'] as const
export const PUBLIC_PANEL_COLOR_KEYS=['background','panel','panel_alt','accent','accent_secondary','text','line','hot','called_text'] as const

export type PublicPanelTheme=typeof PUBLIC_PANEL_THEMES[number]
export type PublicPanelBoardStyle=typeof PUBLIC_PANEL_BOARD_STYLES[number]
export type PublicPanelBallAnimation=typeof PUBLIC_PANEL_BALL_ANIMATIONS[number]
export type PublicPanelVictoryAnimation=typeof PUBLIC_PANEL_VICTORY_ANIMATIONS[number]
export type PublicPanelAnimationIntensity=typeof PUBLIC_PANEL_ANIMATION_INTENSITIES[number]
export type PublicPanelColorKey=typeof PUBLIC_PANEL_COLOR_KEYS[number]
export type PublicPanelColors=Record<PublicPanelColorKey,string>
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
  event_contact:string
  use_custom_colors:boolean
  custom_colors:Partial<PublicPanelColors>
}


export const PUBLIC_PANEL_THEME_PALETTES:Record<PublicPanelTheme,PublicPanelColors>={
  classic:{background:'#080808',panel:'#111318',panel_alt:'#171a21',accent:'#ef1b24',accent_secondary:'#ff5a62',text:'#ffffff',line:'#343841',hot:'#fbbf24',called_text:'#ffffff'},
  neon:{background:'#03040b',panel:'#080d18',panel_alt:'#0a1322',accent:'#00f0ff',accent_secondary:'#ff2bd6',text:'#ecfeff',line:'#145866',hot:'#faff00',called_text:'#001013'},
  gold:{background:'#080604',panel:'#151008',panel_alt:'#21180c',accent:'#dcae35',accent_secondary:'#fff0a8',text:'#fff9e9',line:'#5b4822',hot:'#ffd75a',called_text:'#201500'},
  party:{background:'#090512',panel:'#151023',panel_alt:'#201433',accent:'#ff3d9a',accent_secondary:'#7c5cff',text:'#ffffff',line:'#60305e',hot:'#ffe24a',called_text:'#ffffff'},
  elegant:{background:'#090b0f',panel:'#14171c',panel_alt:'#1a1f25',accent:'#c4a77d',accent_secondary:'#e8dcc7',text:'#f4efe8',line:'#4f463a',hot:'#d9bd8c',called_text:'#15120e'},
  minimal:{background:'#f3f4f6',panel:'#ffffff',panel_alt:'#f8fafc',accent:'#111827',accent_secondary:'#374151',text:'#111827',line:'#d1d5db',hot:'#b45309',called_text:'#ffffff'},
  led:{background:'#020503',panel:'#051009',panel_alt:'#07160c',accent:'#32ff72',accent_secondary:'#a8ffc1',text:'#ddffe6',line:'#175b2c',hot:'#ffe34d',called_text:'#001707'},
  colorful:{background:'#080b16',panel:'#11182b',panel_alt:'#17233e',accent:'#5ee7ff',accent_secondary:'#ff6bb5',text:'#ffffff',line:'#35517e',hot:'#ffd75a',called_text:'#08111f'},
}

export const DEFAULT_PUBLIC_PANEL_APPEARANCE:PublicPanelAppearance={theme:'classic',board_style:'blocks',ball_animation:'zoom',victory_animation:'confetti',animation_intensity:'normal',show_round_name:true,show_prize:true,show_recent_numbers:true,show_counters:true,animated_frame:false,event_contact:'',use_custom_colors:false,custom_colors:{}}

const oneOf=<T extends readonly string[]>(value:unknown,allowed:T,fallback:T[number]):T[number]=>allowed.includes(value as T[number])?value as T[number]:fallback
const HEX=/^#[0-9a-f]{6}$/i
function normalizeColors(value:unknown):Partial<PublicPanelColors>{
  const raw=(value&&typeof value==='object'?value:{}) as Record<string,unknown>
  const result:Partial<PublicPanelColors>={}
  for(const key of PUBLIC_PANEL_COLOR_KEYS){const color=raw[key];if(typeof color==='string'&&HEX.test(color))result[key]=color}
  return result
}
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
    event_contact:typeof raw.event_contact==='string'?raw.event_contact.trim().slice(0,80):'',
    use_custom_colors:typeof raw.use_custom_colors==='boolean'?raw.use_custom_colors:false,
    custom_colors:normalizeColors(raw.custom_colors),
  }
}
export const PUBLIC_PANEL_THEME_LABELS:Record<PublicPanelTheme,string>={classic:'BINGOUP clássico',neon:'Neon Arcade',gold:'Palco Premium',party:'Festa',elegant:'Elegante',minimal:'Minimalista',led:'Placar LED',colorful:'Mosaico Colorido'}
export const PUBLIC_PANEL_THEME_DESCRIPTIONS:Record<PublicPanelTheme,string>={
  classic:'Painel esportivo tradicional, forte hierarquia e leitura rápida.',
  neon:'Visual arcade com molduras luminosas, grade digital e detalhes futuristas.',
  gold:'Composição de palco premium, destaque central e acabamento sofisticado.',
  party:'Blocos assimétricos, formas decorativas e clima de festa.',
  elegant:'Layout editorial mais espaçado, tipografia refinada e poucos elementos.',
  minimal:'Interface clara e plana, quase sem molduras e com máxima legibilidade.',
  led:'Placar eletrônico quadrado, tipografia monoespaçada e aparência de matriz.',
  colorful:'Painéis em mosaico, cartões variados e composição dinâmica.',
}
export const PUBLIC_PANEL_BOARD_STYLE_LABELS:Record<PublicPanelBoardStyle,string>={blocks:'Blocos',balls:'Bolas circulares',led:'Painel eletrônico',cards:'Cartões',giant:'Números grandes',compact:'Grade compacta'}
export const PUBLIC_PANEL_BALL_ANIMATION_LABELS:Record<PublicPanelBallAnimation,string>={zoom:'Zoom',spin:'Giro suave',bounce:'Quicar',pulse:'Pulso',slide:'Entrada lateral',glow:'Brilho',none:'Sem animação'}
export const PUBLIC_PANEL_VICTORY_ANIMATION_LABELS:Record<PublicPanelVictoryAnimation,string>={confetti:'Confetes',gold_rain:'Chuva dourada',fireworks:'Fogos estilizados',stars:'Estrelas',particles:'Explosão de partículas',elegant:'Destaque elegante',none:'Sem animação'}
export const PUBLIC_PANEL_ANIMATION_INTENSITY_LABELS:Record<PublicPanelAnimationIntensity,string>={subtle:'Discreta',normal:'Normal',party:'Festa'}
export const PUBLIC_PANEL_COLOR_LABELS:Record<PublicPanelColorKey,string>={background:'Fundo geral',panel:'Painel principal',panel_alt:'Painel secundário',accent:'Destaque principal',accent_secondary:'Destaque secundário',text:'Texto',line:'Linhas e bordas',hot:'Alerta / vitória',called_text:'Texto do número marcado'}
