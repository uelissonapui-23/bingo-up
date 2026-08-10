import type {BingoWinPattern} from '@/types/database'

export const STANDARD_WIN_PATTERNS:BingoWinPattern[]=[
  {code:'any_five',name:'Qualquer quina',kind:'any_line'},
  {code:'row_1',name:'Quina específica: 1ª linha',kind:'specific_row',target_index:0},
  {code:'row_2',name:'Quina específica: 2ª linha',kind:'specific_row',target_index:1},
  {code:'row_3',name:'Quina específica: 3ª linha',kind:'specific_row',target_index:2},
  {code:'row_4',name:'Quina específica: 4ª linha',kind:'specific_row',target_index:3},
  {code:'row_5',name:'Quina específica: 5ª linha',kind:'specific_row',target_index:4},
  {code:'any_column',name:'Qualquer letra/coluna',kind:'any_column'},
  {code:'column_b',name:'Letra específica: B',kind:'specific_column',target_index:0},
  {code:'column_i',name:'Letra específica: I',kind:'specific_column',target_index:1},
  {code:'column_n',name:'Letra específica: N',kind:'specific_column',target_index:2},
  {code:'column_g',name:'Letra específica: G',kind:'specific_column',target_index:3},
  {code:'column_o',name:'Letra específica: O',kind:'specific_column',target_index:4},
  {code:'any_diagonal',name:'Qualquer diagonal',kind:'any_diagonal'},
  {code:'diagonal_main',name:'Diagonal principal',kind:'diagonal_main'},
  {code:'diagonal_secondary',name:'Diagonal secundária',kind:'diagonal_secondary'},
  {code:'four_corners',name:'Quatro cantos',kind:'four_corners'},
  {code:'full_card',name:'Cartela cheia',kind:'full_card'},
]

export function mergeWinPatterns(patterns:BingoWinPattern[]):BingoWinPattern[]{
  const seen=new Set<string>()
  return [...patterns,...STANDARD_WIN_PATTERNS].filter(pattern=>{if(seen.has(pattern.code))return false;seen.add(pattern.code);return true})
}
