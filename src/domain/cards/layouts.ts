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
  {key:'double_equal',format:2,name:'2 em 1 · Dois grandes',description:'Dois jogos grandes empilhados.',orientation:'portrait',gameAreas:[{x:10,y:29,width:80,height:27,emphasis:'primary'},{x:10,y:59,width:80,height:27,emphasis:'secondary'}]},
  {key:'double_feature',format:2,name:'2 em 1 · Principal + apoio',description:'Um jogo principal grande e um segundo jogo menor.',orientation:'portrait',gameAreas:[{x:8,y:31,width:58,height:37,emphasis:'primary'},{x:69,y:43,width:24,height:25,emphasis:'secondary'}]},
  {key:'double_side_by_side',format:2,name:'2 em 1 · Lado a lado',description:'Dois jogos equivalentes lado a lado.',orientation:'portrait',gameAreas:[{x:6,y:42,width:42,height:32,emphasis:'primary'},{x:52,y:42,width:42,height:32,emphasis:'secondary'}]},
  {key:'triple_main_two',format:3,name:'3 em 1 · Principal + 2',description:'Um jogo principal e dois jogos menores de apoio.',orientation:'portrait',gameAreas:[{x:7,y:30,width:58,height:35,emphasis:'primary'},{x:68,y:35,width:25,height:22,emphasis:'secondary'},{x:68,y:61,width:25,height:22,emphasis:'secondary'}]},
  {key:'triple_stacked',format:3,name:'3 em 1 · Empilhados',description:'Três jogos horizontais empilhados.',orientation:'portrait',gameAreas:[{x:10,y:29,width:80,height:18,emphasis:'primary'},{x:10,y:50,width:80,height:18,emphasis:'secondary'},{x:10,y:71,width:80,height:18,emphasis:'secondary'}]},
  {key:'triple_equal',format:3,name:'3 em 1 · Equilibrado',description:'Um jogo superior e dois inferiores com tamanhos próximos.',orientation:'portrait',gameAreas:[{x:12,y:28,width:76,height:27,emphasis:'primary'},{x:8,y:60,width:40,height:26,emphasis:'secondary'},{x:52,y:60,width:40,height:26,emphasis:'secondary'}]},
]

export function layoutsForFormat(format:1|2|3){return CARD_LAYOUT_PRESETS.filter(item=>item.format===format)}
export function getCardLayoutPreset(layoutKey:string,format?:1|2|3){return CARD_LAYOUT_PRESETS.find(item=>item.key===layoutKey)??(format?layoutsForFormat(format)[0]:undefined)}
