import {supabase} from '@/services/supabase/client'
import type {EventSettings,MembershipStatus} from '@/types/database'
import type {PublicPanelAppearance} from '@/domain/draw/publicPanelAppearance'

export type OperatorTeamRow={user_id:string;display_name:string|null;email:string|null;status:MembershipStatus;event_ids:string[]}
export type OperatorInviteInfo={workspace_name:string;email:string;expires_at:string;status:string;event_names:string[]}
export type OperatorEventOption={id:string;name:string;status:string;starts_at:string|null}

export async function listOperatorWorkspaceEvents(workspaceId:string):Promise<OperatorEventOption[]>{
  const {data,error}=await supabase.from('events').select('id,name,status,starts_at').eq('workspace_id',workspaceId).neq('status','archived').order('starts_at',{ascending:true,nullsFirst:false})
  if(error)throw error
  return (data??[]) as OperatorEventOption[]
}
export async function listOperatorTeam(workspaceId:string):Promise<OperatorTeamRow[]>{
  const {data,error}=await supabase.rpc('list_draw_operator_team',{target_workspace_id:workspaceId})
  if(error)throw error
  return (data??[]).map((row:any)=>({...row,event_ids:row.event_ids??[]}))
}
export async function createOperatorInvitation(workspaceId:string,email:string,eventIds:string[]){
  const {data,error}=await supabase.rpc('create_draw_operator_invitation',{target_workspace_id:workspaceId,target_email:email,target_event_ids:eventIds})
  if(error)throw error
  return data as string
}
export async function getOperatorInvitation(token:string){
  const {data,error}=await supabase.rpc('get_draw_operator_invitation',{invite_token:token})
  if(error)throw error
  return (data?.[0]??null) as OperatorInviteInfo|null
}
export async function acceptOperatorInvitation(token:string){
  const {data,error}=await supabase.rpc('accept_draw_operator_invitation',{invite_token:token})
  if(error)throw error
  return data as string
}
export async function setOperatorAssignments(workspaceId:string,userId:string,eventIds:string[]){
  const {error}=await supabase.rpc('set_draw_operator_event_assignments',{target_workspace_id:workspaceId,target_operator_user_id:userId,target_event_ids:eventIds})
  if(error)throw error
}
export async function setOperatorStatus(workspaceId:string,userId:string,status:'active'|'suspended'|'revoked'){
  const {error}=await supabase.rpc('set_draw_operator_membership_status',{target_workspace_id:workspaceId,target_operator_user_id:userId,target_status:status})
  if(error)throw error
}
export async function getOperatorPanelEvent(workspaceId:string,eventId:string){
  const {data:event,error}=await supabase.from('events').select('id,name,status').eq('workspace_id',workspaceId).eq('id',eventId).single()
  if(error)throw error
  const {data:settings,error:settingsError}=await supabase.from('event_settings').select('*').eq('workspace_id',workspaceId).eq('event_id',eventId).single()
  if(settingsError)throw settingsError
  return {event:event as {id:string;name:string;status:string},settings:settings as EventSettings}
}
export async function updateOperatorPublicPanel(eventId:string,patch:{public_panel_show_last_number?:boolean;public_panel_show_called_numbers?:boolean;public_panel_show_progress?:boolean;public_panel_show_near_winners?:boolean;appearance?:PublicPanelAppearance}){
  const {error}=await supabase.rpc('update_draw_operator_public_panel',{target_event_id:eventId,target_patch:patch})
  if(error)throw error
}
