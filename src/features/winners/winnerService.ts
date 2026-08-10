import {supabase} from '@/services/supabase/client'
import type {GameDefinition,WinnerCandidateStatus} from '@/types/database'

export type WinnerCheck={
 id:string;status:WinnerCandidateStatus;detected_at:string;resolved_at:string|null;resolution_note:string|null;physical_card_id:string;card_game_id:string;trigger_draw_number_id:string|null
 card:{code:string;status:string;sold_at:string|null;current_sale_id:string|null}
 game:{position:number;definition:GameDefinition}
 sale:{buyer_name:string|null;buyer_phone:string|null;buyer_email:string|null}|null
 trigger:{number:number;sequence_number:number;called_at:string}|null
 progress:{matched_count:number;missing_count:number;is_winner:boolean}
 called_numbers:number[]
}
export async function findCandidateForCard(sessionId:string,code:string):Promise<WinnerCheck[]>{
 const clean=code.trim();if(!clean)return[]
 const {data:session,error:sessionError}=await supabase.from('draw_sessions').select('workspace_id,event_id').eq('id',sessionId).single();if(sessionError)throw sessionError
 const {data:card,error:ce}=await supabase.from('physical_cards').select('id,code,status,sold_at,current_sale_id').eq('workspace_id',session.workspace_id).eq('event_id',session.event_id).eq('code',clean).maybeSingle();if(ce)throw ce;if(!card)return[]
 const {data:candidates,error}=await supabase.from('winner_candidates').select('id,status,detected_at,resolved_at,resolution_note,physical_card_id,card_game_id,trigger_draw_number_id').eq('session_id',sessionId).eq('physical_card_id',card.id).order('detected_at');if(error)throw error
 if(!candidates?.length)return[]
 const gameIds=candidates.map(c=>c.card_game_id);const triggerIds=candidates.map(c=>c.trigger_draw_number_id).filter(Boolean) as string[]
 const [{data:games,error:ge},{data:progress,error:pe},{data:triggers,error:te},{data:sale,error:se},{data:drawn,error:de}]=await Promise.all([
  supabase.from('card_games').select('id,position,game_definitions!inner(*)').in('id',gameIds),
  supabase.from('game_progress').select('card_game_id,matched_count,missing_count,is_winner').eq('session_id',sessionId).in('card_game_id',gameIds),
  triggerIds.length?supabase.from('draw_numbers').select('id,number,sequence_number,called_at').in('id',triggerIds):Promise.resolve({data:[],error:null}),
  card.current_sale_id?supabase.from('sales').select('buyer_name,buyer_phone,buyer_email').eq('id',card.current_sale_id).maybeSingle():Promise.resolve({data:null,error:null}),
  supabase.from('draw_numbers').select('number').eq('session_id',sessionId).eq('status','called').order('sequence_number')
 ]);if(ge)throw ge;if(pe)throw pe;if(te)throw te;if(se)throw se;if(de)throw de
 const calledNumbers=(drawn??[]).map(row=>row.number as number)
 return candidates.map(c=>{const g:any=games?.find((x:any)=>x.id===c.card_game_id);const p:any=progress?.find((x:any)=>x.card_game_id===c.card_game_id);const t:any=triggers?.find((x:any)=>x.id===c.trigger_draw_number_id);return {...c,card,game:{position:g?.position??1,definition:g?.game_definitions},sale:sale??null,trigger:t??null,progress:p??{matched_count:0,missing_count:999,is_winner:false},called_numbers:calledNumbers} as WinnerCheck})
}
export async function getCandidateCheck(candidateId:string):Promise<WinnerCheck>{
 const {data:c,error}=await supabase.from('winner_candidates').select('id,status,detected_at,resolved_at,resolution_note,physical_card_id,card_game_id,trigger_draw_number_id,session_id').eq('id',candidateId).single();if(error)throw error
 const rows=await findCandidateForCard(c.session_id,(await supabase.from('physical_cards').select('code').eq('id',c.physical_card_id).single()).data?.code??'');const row=rows.find(r=>r.id===candidateId);if(!row)throw new Error('Não foi possível carregar a conferência.');return row
}
export async function confirmWinner(candidateId:string,note?:string){const {data,error}=await supabase.rpc('confirm_winner_candidate',{target_candidate_id:candidateId,note:note||null});if(error)throw error;return data as string}
export async function dismissWinner(candidateId:string,note:string){const {error}=await supabase.rpc('dismiss_winner_candidate',{target_candidate_id:candidateId,note});if(error)throw error}
export async function listConfirmedWinners(sessionId:string){const {data,error}=await supabase.from('winners').select('id,candidate_id,physical_card_id,card_game_id,confirmed_at,confirmation_note,physical_cards(code),card_games(position)').eq('session_id',sessionId).order('confirmed_at');if(error)throw error;return data??[]}
