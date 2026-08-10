import {supabase} from '@/services/supabase/client'
export type PublicDigitalGame={position:number;numbers:number[];cells:Array<number|null>}
export type PublicDigitalCardState={
  available:boolean;reason?:string
  event?:{id:string;name:string;status:string}
  card?:{id:string;code:string;sequence_number:number;physical_format:number;status:string;series_code:string;layout_key:string}
  rule?:{grid_columns:number;grid_rows:number;column_definitions:Array<{label?:string}>;has_free_center:boolean}
  games?:PublicDigitalGame[]
  draw?:null|{id:string;session_number:number;name:string;status:string;win_pattern_code:string;called_count:number;last_called_number:number|null;called_numbers:number[];is_winner:boolean}
  updated_at?:string
}
export async function getPublicDigitalCard(token:string){
  const {data,error}=await supabase.rpc('get_public_digital_card',{card_token:token})
  if(error)throw error
  return data as PublicDigitalCardState
}
