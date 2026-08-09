import { supabase } from '@/services/supabase/client'
import type { CardBatch, CardTemplate, GameDefinition, PhysicalCard, PhysicalCardStatus, BingoRuleSet } from '@/types/database'

export type CardGameView={position:number;definition:GameDefinition}
export type PhysicalCardView=PhysicalCard&{games:CardGameView[];batch:CardBatch;template:CardTemplate;rule:BingoRuleSet}
export type CardListFilters={batchId?:string;status?:PhysicalCardStatus;search?:string;fromSequence?:number;toSequence?:number;limit?:number}

export async function listEventCards(workspaceId:string,eventId:string,filters?:CardListFilters){
  let q=supabase.from('physical_cards').select('*, card_batches!inner(*), card_templates!inner(*), bingo_rule_sets!inner(*)')
    .eq('workspace_id',workspaceId).eq('event_id',eventId).order('sequence_number')
  if(filters?.batchId)q=q.eq('batch_id',filters.batchId)
  if(filters?.status)q=q.eq('status',filters.status)
  if(filters?.search)q=q.ilike('code',`%${filters.search.replace(/[%_]/g,'')}%`)
  if(filters?.fromSequence!=null)q=q.gte('sequence_number',filters.fromSequence)
  if(filters?.toSequence!=null)q=q.lte('sequence_number',filters.toSequence)
  q=q.limit(filters?.limit??500)
  const {data,error}=await q;if(error)throw error
  return (data??[]).map((row:any)=>({...row,batch:row.card_batches,template:row.card_templates,rule:row.bingo_rule_sets})) as Array<PhysicalCard&{batch:CardBatch;template:CardTemplate;rule:BingoRuleSet}>
}

export async function getPhysicalCard(workspaceId:string,eventId:string,cardId:string):Promise<PhysicalCardView>{
  const {data,error}=await supabase.from('physical_cards').select('*, card_batches!inner(*), card_templates!inner(*), bingo_rule_sets!inner(*)').eq('workspace_id',workspaceId).eq('event_id',eventId).eq('id',cardId).single();if(error)throw error
  const {data:games,error:gamesError}=await supabase.from('card_games').select('position, game_definitions!inner(*)').eq('physical_card_id',cardId).order('position');if(gamesError)throw gamesError
  const row:any=data
  return {...row,batch:row.card_batches,template:row.card_templates,rule:row.bingo_rule_sets,games:(games??[]).map((game:any)=>({position:game.position,definition:game.game_definitions}))} as PhysicalCardView
}

export async function listBatchCardsForPrint(workspaceId:string,eventId:string,batchId:string,filters?:{fromSequence?:number;toSequence?:number;limit?:number}){
  const limit=Math.min(500,Math.max(1,filters?.limit??500))
  const base=await listEventCards(workspaceId,eventId,{batchId,fromSequence:filters?.fromSequence,toSequence:filters?.toSequence,limit})
  if(!base.length)return [] as PhysicalCardView[]
  const ids=base.map(card=>card.id)
  const by=new Map<string,CardGameView[]>()
  // Supabase/PostgREST URLs become unreliable with very large IN lists; keep requests bounded.
  for(let offset=0;offset<ids.length;offset+=150){
    const chunk=ids.slice(offset,offset+150)
    const {data,error}=await supabase.from('card_games').select('physical_card_id,position,game_definitions!inner(*)').in('physical_card_id',chunk).order('position');if(error)throw error
    for(const game of data??[]){const row:any=game;const current=by.get(row.physical_card_id)??[];current.push({position:row.position,definition:row.game_definitions});by.set(row.physical_card_id,current)}
  }
  return base.map(card=>({...card,games:by.get(card.id)??[]})) as PhysicalCardView[]
}

export async function voidPhysicalCard(cardId:string,reason:string){const {error}=await supabase.rpc('void_physical_card',{target_card_id:cardId,reason});if(error)throw error}
export async function registerPrint(batchId:string,cardIds:string[]){const {error}=await supabase.rpc('register_card_print',{target_batch_id:batchId,target_card_ids:cardIds});if(error)throw error}
