import { supabase } from '@/services/supabase/client'
import type { MembershipStatus } from '@/types/database'

export type SellerTeamRow={user_id:string;display_name:string|null;email:string|null;status:MembershipStatus;event_ids:string[];completed_sales:number;completed_amount:number}
export type SellerInviteInfo={workspace_name:string;email:string;expires_at:string;status:string;event_names:string[]}
export type SellerEventOption={id:string;name:string;status:string;starts_at:string|null}

export async function listWorkspaceEvents(workspaceId:string):Promise<SellerEventOption[]>{
  const {data,error}=await supabase.from('events').select('id,name,status,starts_at').eq('workspace_id',workspaceId).neq('status','archived').order('starts_at',{ascending:true,nullsFirst:false})
  if(error)throw error
  return (data??[]) as SellerEventOption[]
}
export async function listSellerTeam(workspaceId:string):Promise<SellerTeamRow[]>{
  const {data,error}=await supabase.rpc('list_seller_team',{target_workspace_id:workspaceId})
  if(error)throw error
  return (data??[]).map((r:any)=>({...r,event_ids:r.event_ids??[],completed_sales:Number(r.completed_sales??0),completed_amount:Number(r.completed_amount??0)}))
}
export async function createSellerInvitation(workspaceId:string,email:string,eventIds:string[]){
  const {data,error}=await supabase.rpc('create_seller_invitation',{target_workspace_id:workspaceId,target_email:email,target_event_ids:eventIds})
  if(error)throw error
  return data as string
}
export async function getSellerInvitation(token:string){
  const {data,error}=await supabase.rpc('get_seller_invitation',{invite_token:token})
  if(error)throw error
  return (data?.[0]??null) as SellerInviteInfo|null
}
export async function acceptSellerInvitation(token:string){
  const {data,error}=await supabase.rpc('accept_seller_invitation',{invite_token:token})
  if(error)throw error
  return data as string
}
export async function setSellerAssignments(workspaceId:string,userId:string,eventIds:string[]){
  const {error}=await supabase.rpc('set_seller_event_assignments',{target_workspace_id:workspaceId,target_seller_user_id:userId,target_event_ids:eventIds})
  if(error)throw error
}
export async function setSellerStatus(workspaceId:string,userId:string,status:'active'|'suspended'|'revoked'){
  const {error}=await supabase.rpc('set_seller_membership_status',{target_workspace_id:workspaceId,target_seller_user_id:userId,target_status:status})
  if(error)throw error
}
