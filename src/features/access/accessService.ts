import {supabase} from '@/services/supabase/client'

export type AccessEvent={workspace_id:string;workspace_name:string;event_id:string;event_name:string;status:string;starts_at:string|null}
export type OrganizerAccess={workspace_id:string;workspace_name:string;role:string}
export type BuyerEvent={event_id:string;event_name:string;status:string;starts_at:string|null;organizer_name:string;cards:number}
export type AccessCenters={is_master:boolean;organizers:OrganizerAccess[];seller_events:AccessEvent[];operator_events:AccessEvent[];buyer_events:BuyerEvent[]}
export type BuyerEventState={event:{id:string;name:string;status:string};public_session_token:string|null;winner_count:number;winner_prizes:string[];latest_win:null|{prize:string;my_winners:number;total_winners:number;buyer_name:string|null};wins:Array<{winner_id:string;prize:string;round_name:string;card_code:string;game_position:number;confirmed_at:string;delivered:boolean}>;cards:Array<{id:string;code:string;public_token:string;physical_format:number;buyer_name:string|null;is_winner:boolean}>}
export type BuyerDigitalGame={position:number;numbers:number[];cells:Array<number|null>}
export type BuyerDigitalCardState={event:{id:string;name:string;status:string};card:{id:string;code:string;sequence_number:number;physical_format:number;status:string;series_code:string;layout_key:string};rule:{grid_columns:number;grid_rows:number;column_definitions:Array<{label?:string}>;has_free_center:boolean};games:BuyerDigitalGame[];draw:null|{id:string;session_number:number;name:string;status:string;win_pattern_code:string;called_count:number;last_called_number:number|null;called_numbers:number[];is_winner:boolean};updated_at:string}

export async function listMyAccessCenters(){const {data,error}=await supabase.rpc('list_my_access_centers');if(error)throw error;return data as AccessCenters}
export async function getMyBuyerEvent(eventId:string){const {data,error}=await supabase.rpc('get_my_buyer_event',{target_event_id:eventId});if(error)throw error;return data as BuyerEventState}

export async function getMyBuyerDigitalCard(eventId:string,cardId:string){const {data,error}=await supabase.rpc('get_my_buyer_digital_card',{target_event_id:eventId,target_card_id:cardId});if(error)throw error;return data as BuyerDigitalCardState}
