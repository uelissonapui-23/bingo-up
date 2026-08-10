import { supabase } from '@/services/supabase/client'
import type { BingoRuleSet, DrawNumber, DrawSession } from '@/types/database'

export async function listDrawEvents(workspaceId:string){
  const {data,error}=await supabase.from('events').select('id,name,status,starts_at').eq('workspace_id',workspaceId).neq('status','archived').order('starts_at',{ascending:false,nullsFirst:false}).order('created_at',{ascending:false})
  if(error) throw error
  return (data??[]) as Array<{id:string;name:string;status:string;starts_at:string|null}>
}

export async function listEventRuleSets(workspaceId:string,eventId:string):Promise<BingoRuleSet[]>{
  const {data,error}=await supabase.from('bingo_rule_sets').select('*').eq('workspace_id',workspaceId).eq('event_id',eventId).eq('is_active',true).order('is_default',{ascending:false}).order('created_at')
  if(error) throw error
  return (data??[]) as BingoRuleSet[]
}

export async function getOpenDrawSession(workspaceId:string,eventId:string):Promise<DrawSession|null>{
  const {data,error}=await supabase.from('draw_sessions').select('*').eq('workspace_id',workspaceId).eq('event_id',eventId).in('status',['active','paused']).order('session_number',{ascending:false}).limit(1).maybeSingle()
  if(error) throw error
  return data as DrawSession|null
}

export async function listDrawHistory(workspaceId:string,eventId:string):Promise<DrawSession[]>{
  const {data,error}=await supabase.from('draw_sessions').select('*').eq('workspace_id',workspaceId).eq('event_id',eventId).order('session_number',{ascending:false})
  if(error) throw error
  return (data??[]) as DrawSession[]
}

export async function listDrawNumbers(sessionId:string):Promise<DrawNumber[]>{
  const {data,error}=await supabase.from('draw_numbers').select('*').eq('session_id',sessionId).order('sequence_number',{ascending:true})
  if(error) throw error
  return (data??[]) as DrawNumber[]
}

export async function createDrawSession(eventId:string,ruleSetId:string,winPatternCode:string,name?:string,options?:{continueNumbers?:boolean;drawMethod?:'automatic'|'manual'}){
  const {data,error}=await supabase.rpc('create_draw_session',{target_event_id:eventId,target_rule_set_id:ruleSetId,target_win_pattern_code:winPatternCode,target_name:name||null,target_continue_numbers:options?.continueNumbers??false,target_draw_method:options?.drawMethod??'automatic'})
  if(error) throw error
  return data as string
}

export async function drawNextNumber(sessionId:string){
  const {data,error}=await supabase.rpc('draw_next_number',{target_session_id:sessionId})
  if(error) throw error
  return data as number
}
export async function callManualNumber(sessionId:string,number:number){
  const {data,error}=await supabase.rpc('call_manual_draw_number',{target_session_id:sessionId,target_number:number})
  if(error)throw error
  return data as number
}
export async function pauseDraw(sessionId:string){const {error}=await supabase.rpc('pause_draw_session',{target_session_id:sessionId});if(error)throw error}
export async function resumeDraw(sessionId:string){const {error}=await supabase.rpc('resume_draw_session',{target_session_id:sessionId});if(error)throw error}
export async function undoLastNumber(sessionId:string,reason?:string){const {data,error}=await supabase.rpc('undo_last_draw_number',{target_session_id:sessionId,reason:reason||null});if(error)throw error;return data as number}
export async function finishDraw(sessionId:string,finishEvent=true){const {error}=await supabase.rpc('finish_draw_session',{target_session_id:sessionId,finish_event:finishEvent});if(error)throw error}
export async function cancelDraw(sessionId:string,reason?:string){const {error}=await supabase.rpc('cancel_draw_session',{target_session_id:sessionId,reason:reason||null});if(error)throw error}

export function subscribeToDraw(sessionId:string,onChange:()=>void){
  const channel=supabase.channel(`draw-${sessionId}-${crypto.randomUUID()}`)
    .on('postgres_changes',{event:'*',schema:'public',table:'draw_sessions',filter:`id=eq.${sessionId}`},onChange)
    .on('postgres_changes',{event:'*',schema:'public',table:'draw_numbers',filter:`session_id=eq.${sessionId}`},onChange)
    .on('postgres_changes',{event:'*',schema:'public',table:'game_progress',filter:`session_id=eq.${sessionId}`},onChange)
    .on('postgres_changes',{event:'*',schema:'public',table:'winner_candidates',filter:`session_id=eq.${sessionId}`},onChange)
    .subscribe()
  return ()=>{void supabase.removeChannel(channel)}
}


export function subscribeToEventDraw(eventId:string,onChange:()=>void){
  const channel=supabase.channel(`draw-event-${eventId}-${crypto.randomUUID()}`)
    .on('postgres_changes',{event:'*',schema:'public',table:'draw_sessions',filter:`event_id=eq.${eventId}`},onChange)
    .on('postgres_changes',{event:'*',schema:'public',table:'events',filter:`id=eq.${eventId}`},onChange)
    .subscribe()
  return ()=>{void supabase.removeChannel(channel)}
}

export type DrawProgressRow={session_id:string;physical_card_id:string;card_game_id:string;position:number;matched_count:number;missing_count:number;is_winner:boolean;completed_at:string|null;card_code:string|null}
export type WinnerCandidateView={id:string;physical_card_id:string;card_game_id:string;status:string;detected_at:string;physical_cards:{code:string}|null;draw_session_games:{position:number}|null}

export async function refreshDrawProgress(sessionId:string){const {data,error}=await supabase.rpc('refresh_draw_progress',{target_session_id:sessionId});if(error)throw error;return data as {one_away:number;two_away:number;winners:number;evaluated_games:number}}
export async function listDrawProgress(sessionId:string):Promise<DrawProgressRow[]>{
  const {data,error}=await supabase.from('game_progress').select('session_id,physical_card_id,card_game_id,position,matched_count,missing_count,is_winner,completed_at').eq('session_id',sessionId).order('missing_count').order('position')
  if(error)throw error
  const rows=(data??[]) as Omit<DrawProgressRow,'card_code'>[]
  const cardIds=[...new Set(rows.map(row=>row.physical_card_id))]
  if(!cardIds.length)return []
  const {data:cards,error:cardError}=await supabase.from('physical_cards').select('id,code').in('id',cardIds)
  if(cardError)throw cardError
  const codes=new Map((cards??[]).map(card=>[card.id,card.code]))
  return rows.map(row=>({...row,card_code:codes.get(row.physical_card_id)??null}))
}
export async function listWinnerCandidates(sessionId:string):Promise<WinnerCandidateView[]>{const {data,error}=await supabase.from('winner_candidates').select('id,physical_card_id,card_game_id,status,detected_at,physical_cards(code)').eq('session_id',sessionId).in('status',['detected','confirmed']).order('detected_at');if(error)throw error;const rows=(data??[]) as any[];const progress=await listDrawProgress(sessionId);return rows.map(row=>({...row,draw_session_games:{position:progress.find(p=>p.card_game_id===row.card_game_id)?.position??1}})) as WinnerCandidateView[]}

export async function reopenEventForNextDraw(eventId:string){
  const {error}=await supabase.rpc('reopen_event_for_next_draw',{target_event_id:eventId})
  if(error)throw error
}
