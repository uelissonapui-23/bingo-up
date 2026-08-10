export type GameArea = { x:number; y:number; width:number; height:number; emphasis?:'primary'|'secondary' }
export type CardLayoutPreset = {
  key:string
  format:1|2|3
  name:string
  description:string
  orientation:'portrait'|'landscape'
  gameAreas:GameArea[]
}

export const CARD_LAYOUT_PRESETS:CardLayoutPreset[]=[
  {key:'single_showcase',format:1,name:'1 em 1 · Destaque',description:'Um jogo grande central, com bastante área livre para a arte.',orientation:'portrait',gameAreas:[{x:10,y:31,width:80,height:38,emphasis:'primary'}]},
  {key:'single_lower',format:1,name:'1 em 1 · Jogo inferior',description:'Arte em destaque no topo e jogo grande na metade inferior.',orientation:'portrait',gameAreas:[{x:10,y:48,width:80,height:34,emphasis:'primary'}]},
  {key:'single_compact',format:1,name:'1 em 1 · Compacto',description:'Jogo central compacto para artes com muitas informações.',orientation:'portrait',gameAreas:[{x:17,y:38,width:66,height:31,emphasis:'primary'}]},
  {key:'single_upper',format:1,name:'1 em 1 · Superior',description:'Jogo largo no terço superior, preservando a parte inferior para prêmios e informações.',orientation:'portrait',gameAreas:[{x:9,y:24,width:82,height:33,emphasis:'primary'}]},
  {key:'single_wide',format:1,name:'1 em 1 · Panorâmico',description:'Jogo mais largo e baixo no centro da cartela.',orientation:'portrait',gameAreas:[{x:6,y:38,width:88,height:27,emphasis:'primary'}]},
  {key:'single_left',format:1,name:'1 em 1 · Lateral esquerda',description:'Jogo grande deslocado para a esquerda, liberando uma faixa vertical para a arte.',orientation:'portrait',gameAreas:[{x:6,y:34,width:66,height:36,emphasis:'primary'}]},
  {key:'single_right',format:1,name:'1 em 1 · Lateral direita',description:'Jogo grande deslocado para a direita, ideal para artes com destaque à esquerda.',orientation:'portrait',gameAreas:[{x:28,y:34,width:66,height:36,emphasis:'primary'}]},
  {key:'single_bottom_wide',format:1,name:'1 em 1 · Base ampla',description:'Jogo largo na base, deixando uma grande área superior livre.',orientation:'portrait',gameAreas:[{x:7,y:58,width:86,height:29,emphasis:'primary'}]},

  {key:'double_equal',format:2,name:'2 em 1 · Dois grandes',description:'Dois jogos grandes empilhados.',orientation:'portrait',gameAreas:[{x:10,y:29,width:80,height:27,emphasis:'primary'},{x:10,y:59,width:80,height:27,emphasis:'secondary'}]},
  {key:'double_feature',format:2,name:'2 em 1 · Principal + apoio',description:'Um jogo principal grande e um segundo jogo menor.',orientation:'portrait',gameAreas:[{x:8,y:31,width:58,height:37,emphasis:'primary'},{x:69,y:43,width:24,height:25,emphasis:'secondary'}]},
  {key:'double_side_by_side',format:2,name:'2 em 1 · Lado a lado',description:'Dois jogos equivalentes lado a lado.',orientation:'portrait',gameAreas:[{x:6,y:42,width:42,height:32,emphasis:'primary'},{x:52,y:42,width:42,height:32,emphasis:'secondary'}]},
  {key:'double_spaced',format:2,name:'2 em 1 · Separados',description:'Dois jogos médios com bastante respiro entre eles.',orientation:'portrait',gameAreas:[{x:12,y:25,width:76,height:23,emphasis:'primary'},{x:12,y:66,width:76,height:23,emphasis:'secondary'}]},
  {key:'double_diagonal_down',format:2,name:'2 em 1 · Diagonal',description:'Primeiro jogo no alto à esquerda e segundo no baixo à direita.',orientation:'portrait',gameAreas:[{x:6,y:27,width:58,height:29,emphasis:'primary'},{x:36,y:61,width:58,height:29,emphasis:'secondary'}]},
  {key:'double_diagonal_up',format:2,name:'2 em 1 · Diagonal invertida',description:'Composição diagonal invertida para encaixar artes assimétricas.',orientation:'portrait',gameAreas:[{x:36,y:27,width:58,height:29,emphasis:'primary'},{x:6,y:61,width:58,height:29,emphasis:'secondary'}]},
  {key:'double_wide_center',format:2,name:'2 em 1 · Faixas centrais',description:'Dois jogos largos e mais baixos concentrados no centro.',orientation:'portrait',gameAreas:[{x:5,y:34,width:90,height:21,emphasis:'primary'},{x:5,y:59,width:90,height:21,emphasis:'secondary'}]},
  {key:'double_compact_stack',format:2,name:'2 em 1 · Compactos',description:'Dois jogos compactos centralizados, deixando mais arte ao redor.',orientation:'portrait',gameAreas:[{x:16,y:31,width:68,height:23,emphasis:'primary'},{x:16,y:61,width:68,height:23,emphasis:'secondary'}]},
  {key:'double_tall_columns',format:2,name:'2 em 1 · Colunas altas',description:'Dois jogos altos lado a lado para uma composição vertical marcante.',orientation:'portrait',gameAreas:[{x:6,y:34,width:41,height:39,emphasis:'primary'},{x:53,y:34,width:41,height:39,emphasis:'secondary'}]},
  {key:'double_lower_focus',format:2,name:'2 em 1 · Base dupla',description:'Dois jogos largos posicionados mais abaixo, valorizando a arte no topo.',orientation:'portrait',gameAreas:[{x:9,y:48,width:82,height:19,emphasis:'primary'},{x:9,y:70,width:82,height:19,emphasis:'secondary'}]},

  {key:'triple_main_two',format:3,name:'3 em 1 · Principal + 2',description:'Um jogo principal e dois jogos menores de apoio.',orientation:'portrait',gameAreas:[{x:7,y:30,width:58,height:35,emphasis:'primary'},{x:68,y:35,width:25,height:22,emphasis:'secondary'},{x:68,y:61,width:25,height:22,emphasis:'secondary'}]},
  {key:'triple_stacked',format:3,name:'3 em 1 · Empilhados',description:'Três jogos horizontais empilhados.',orientation:'portrait',gameAreas:[{x:10,y:29,width:80,height:18,emphasis:'primary'},{x:10,y:50,width:80,height:18,emphasis:'secondary'},{x:10,y:71,width:80,height:18,emphasis:'secondary'}]},
  {key:'triple_equal',format:3,name:'3 em 1 · Equilibrado',description:'Um jogo superior e dois inferiores com tamanhos próximos.',orientation:'portrait',gameAreas:[{x:12,y:28,width:76,height:27,emphasis:'primary'},{x:8,y:60,width:40,height:26,emphasis:'secondary'},{x:52,y:60,width:40,height:26,emphasis:'secondary'}]},
  {key:'triple_columns',format:3,name:'3 em 1 · Três colunas',description:'Três jogos verticais lado a lado em uma faixa central.',orientation:'portrait',gameAreas:[{x:4,y:38,width:29,height:34,emphasis:'primary'},{x:35.5,y:38,width:29,height:34,emphasis:'secondary'},{x:67,y:38,width:29,height:34,emphasis:'secondary'}]},
  {key:'triple_left_main',format:3,name:'3 em 1 · Principal à esquerda',description:'Jogo principal alto à esquerda e dois compactos à direita.',orientation:'portrait',gameAreas:[{x:6,y:32,width:55,height:42,emphasis:'primary'},{x:65,y:35,width:29,height:18,emphasis:'secondary'},{x:65,y:58,width:29,height:18,emphasis:'secondary'}]},
  {key:'triple_right_main',format:3,name:'3 em 1 · Principal à direita',description:'Dois jogos compactos à esquerda e jogo principal alto à direita.',orientation:'portrait',gameAreas:[{x:39,y:32,width:55,height:42,emphasis:'primary'},{x:6,y:35,width:29,height:18,emphasis:'secondary'},{x:6,y:58,width:29,height:18,emphasis:'secondary'}]},
  {key:'triple_top_two_bottom',format:3,name:'3 em 1 · Dois em cima + base',description:'Dois jogos superiores e um jogo largo na base.',orientation:'portrait',gameAreas:[{x:7,y:31,width:41,height:27,emphasis:'primary'},{x:52,y:31,width:41,height:27,emphasis:'secondary'},{x:14,y:64,width:72,height:23,emphasis:'secondary'}]},
  {key:'triple_bottom_two_top',format:3,name:'3 em 1 · Destaque superior',description:'Um jogo largo no alto e dois jogos menores na parte inferior.',orientation:'portrait',gameAreas:[{x:14,y:27,width:72,height:25,emphasis:'primary'},{x:7,y:60,width:41,height:27,emphasis:'secondary'},{x:52,y:60,width:41,height:27,emphasis:'secondary'}]},
  {key:'triple_diagonal',format:3,name:'3 em 1 · Diagonal dinâmica',description:'Três jogos compactos descendo em diagonal para uma composição moderna.',orientation:'portrait',gameAreas:[{x:5,y:25,width:48,height:23,emphasis:'primary'},{x:26,y:49,width:48,height:23,emphasis:'secondary'},{x:47,y:73,width:48,height:20,emphasis:'secondary'}]},
  {key:'triple_compact_stack',format:3,name:'3 em 1 · Trio compacto',description:'Três jogos compactos e centralizados, com bastante área para identidade visual.',orientation:'portrait',gameAreas:[{x:18,y:28,width:64,height:17,emphasis:'primary'},{x:18,y:49,width:64,height:17,emphasis:'secondary'},{x:18,y:70,width:64,height:17,emphasis:'secondary'}]},
]

export function layoutsForFormat(format:1|2|3){return CARD_LAYOUT_PRESETS.filter(item=>item.format===format)}
export function getCardLayoutPreset(layoutKey:string,format?:1|2|3){return CARD_LAYOUT_PRESETS.find(item=>item.key===layoutKey)??(format?layoutsForFormat(format)[0]:undefined)}
