import { supabase } from '@/services/supabase/client'
import type { CardBatch, CardTemplate, GameDefinition, PhysicalCard, PhysicalCardStatus, BingoRuleSet } from '@/types/database'

export type CardGameView={position:number;definition:GameDefinition}
export type PhysicalCardView=PhysicalCard&{games:CardGameView[];batch:CardBatch;template:CardTemplate;rule:BingoRuleSet}

export async function listEventCards(workspaceId:string,eventId:string,filters?:{batchId?:string;status?:PhysicalCardStatus;search?:string;limit?:number}){
  let q=supabase.from('physical_cards').select('*, card_batches!inner(*), card_templates!inner(*), bingo_rule_sets!inner(*)')
    .eq('workspace_id',workspaceId).eq('event_id',eventId).order('sequence_number')
  if(filters?.batchId)q=q.eq('batch_id',filters.batchId)
  if(filters?.status)q=q.eq('status',filters.status)
  if(filters?.search)q=q.ilike('code',`%${filters.search.replace(/[%_]/g,'')}%`)
  q=q.limit(filters?.limit??500)
  const {data,error}=await q;if(error)throw error
  return (data??[]).map((r:any)=>({...r,batch:r.card_batches,template:r.card_templates,rule:r.bingo_rule_sets})) as Array<PhysicalCard&{batch:CardBatch;template:CardTemplate;rule:BingoRuleSet}>
}

export async function getPhysicalCard(workspaceId:string,eventId:string,cardId:string):Promise<PhysicalCardView>{
  const {data,error}=await supabase.from('physical_cards').select('*, card_batches!inner(*), card_templates!inner(*), bingo_rule_sets!inner(*)').eq('workspace_id',workspaceId).eq('event_id',eventId).eq('id',cardId).single();if(error)throw error
  const {data:games,error:ge}=await supabase.from('card_games').select('position, game_definitions!inner(*)').eq('physical_card_id',cardId).order('position');if(ge)throw ge
  const r:any=data
  return {...r,batch:r.card_batches,template:r.card_templates,rule:r.bingo_rule_sets,games:(games??[]).map((g:any)=>({position:g.position,definition:g.game_definitions}))} as PhysicalCardView
}

export async function listBatchCardsForPrint(workspaceId:string,eventId:string,batchId:string){
  const base=await listEventCards(workspaceId,eventId,{batchId,limit:10000})
  if(!base.length)return [] as PhysicalCardView[]
  const ids=base.map(c=>c.id)
  const {data,error}=await supabase.from('card_games').select('physical_card_id,position,game_definitions!inner(*)').in('physical_card_id',ids).order('position');if(error)throw error
  const by=new Map<string,CardGameView[]>();for(const g of data??[]){const row:any=g;const arr=by.get(row.physical_card_id)??[];arr.push({position:row.position,definition:row.game_definitions});by.set(row.physical_card_id,arr)}
  return base.map(c=>({...c,games:by.get(c.id)??[]})) as PhysicalCardView[]
}

export async function voidPhysicalCard(cardId:string,reason:string){const {error}=await supabase.rpc('void_physical_card',{target_card_id:cardId,reason});if(error)throw error}
export async function registerPrint(batchId:string,cardIds:string[]){const {error}=await supabase.rpc('register_card_print',{target_batch_id:batchId,target_card_ids:cardIds});if(error)throw error}
