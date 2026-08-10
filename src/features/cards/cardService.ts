import { supabase } from '@/services/supabase/client'
import type { CardBatch, CardTemplate, GameDefinition, PhysicalCard, PhysicalCardStatus, BingoRuleSet } from '@/types/database'
import { parseCardTemplateOptions } from '@/domain/cards/templateOptions'

export type CardGameView={position:number;definition:GameDefinition}
export type PhysicalCardView=PhysicalCard&{games:CardGameView[];batch:CardBatch;template:CardTemplate;rule:BingoRuleSet}

function templateFromBatchSnapshot(batch:CardBatch,current:CardTemplate):CardTemplate{
  const raw=batch.generation_options?.template_snapshot
  const artworkRaw=batch.generation_options?.artwork_snapshot
  const styleRaw=batch.generation_options?.game_style_snapshot
  const artwork=artworkRaw&&typeof artworkRaw==='object'&&!Array.isArray(artworkRaw)?parseCardTemplateOptions({artwork:artworkRaw}).artwork:undefined
  const gameStyle=styleRaw&&typeof styleRaw==='object'&&!Array.isArray(styleRaw)?parseCardTemplateOptions({gameStyle:styleRaw}).gameStyle:undefined
  if(!raw||typeof raw!=='object'||Array.isArray(raw)){const options={...current.options,...(artwork?{artwork}:{}),...(gameStyle?{gameStyle}:{})};return {...current,options}}
  const snapshot=raw as Record<string,unknown>
  if(snapshot.id!==current.id)return artwork?{...current,options:{...current.options,artwork}}:current
  const snapshotOptions=snapshot.options&&typeof snapshot.options==='object'&&!Array.isArray(snapshot.options)?snapshot.options as Record<string,unknown>:current.options
  return {
    ...current,
    name:typeof snapshot.name==='string'?snapshot.name:current.name,
    physical_format:typeof snapshot.physical_format==='number'?snapshot.physical_format:current.physical_format,
    layout_key:typeof snapshot.layout_key==='string'?snapshot.layout_key:current.layout_key,
    orientation:snapshot.orientation==="portrait"||snapshot.orientation==="landscape"?snapshot.orientation:current.orientation,
    page_size:snapshot.page_size==="A4"||snapshot.page_size==="letter"?snapshot.page_size:current.page_size,
    options:{...snapshotOptions,...(artwork?{artwork}:{}),...(gameStyle?{gameStyle}:{})},
  }
}

export async function listEventCards(workspaceId:string,eventId:string,filters?:{batchId?:string;status?:PhysicalCardStatus;search?:string;limit?:number;offset?:number}){
  let q=supabase.from('physical_cards').select('*, card_batches!inner(*), card_templates!inner(*), bingo_rule_sets!inner(*)')
    .eq('workspace_id',workspaceId).eq('event_id',eventId).order('sequence_number')
  if(filters?.batchId)q=q.eq('batch_id',filters.batchId)
  if(filters?.status)q=q.eq('status',filters.status)
  if(filters?.search)q=q.ilike('code',`%${filters.search.replace(/[%_]/g,'')}%`)
  const limit=Math.max(1,Math.min(filters?.limit??500,1000));const offset=Math.max(0,filters?.offset??0);q=q.range(offset,offset+limit-1)
  const {data,error}=await q;if(error)throw error
  return (data??[]).map((r:any)=>{const batch=r.card_batches as CardBatch;const currentTemplate=r.card_templates as CardTemplate;return {...r,batch,template:templateFromBatchSnapshot(batch,currentTemplate),rule:r.bingo_rule_sets}}) as Array<PhysicalCard&{batch:CardBatch;template:CardTemplate;rule:BingoRuleSet}>
}

export async function getPhysicalCard(workspaceId:string,eventId:string,cardId:string):Promise<PhysicalCardView>{
  const {data,error}=await supabase.from('physical_cards').select('*, card_batches!inner(*), card_templates!inner(*), bingo_rule_sets!inner(*)').eq('workspace_id',workspaceId).eq('event_id',eventId).eq('id',cardId).single();if(error)throw error
  const {data:games,error:ge}=await supabase.from('card_games').select('position, game_definitions!inner(*)').eq('physical_card_id',cardId).order('position');if(ge)throw ge
  const r:any=data
  const batch=r.card_batches as CardBatch;const currentTemplate=r.card_templates as CardTemplate
  return {...r,batch,template:templateFromBatchSnapshot(batch,currentTemplate),rule:r.bingo_rule_sets,games:(games??[]).map((g:any)=>({position:g.position,definition:g.game_definitions}))} as PhysicalCardView
}

export async function getCardBatch(workspaceId:string,eventId:string,batchId:string):Promise<CardBatch>{const {data,error}=await supabase.from('card_batches').select('*').eq('workspace_id',workspaceId).eq('event_id',eventId).eq('id',batchId).single();if(error)throw error;return data as CardBatch}

export async function listBatchCardsForPrint(workspaceId:string,eventId:string,batchId:string,offset=0,limit=200){
  const base=await listEventCards(workspaceId,eventId,{batchId,limit,offset})
  if(!base.length)return [] as PhysicalCardView[]
  const by=new Map<string,CardGameView[]>()
  for(let start=0;start<base.length;start+=100){const ids=base.slice(start,start+100).map(c=>c.id);const {data,error}=await supabase.from('card_games').select('physical_card_id,position,game_definitions!inner(*)').in('physical_card_id',ids).order('position');if(error)throw error;for(const g of data??[]){const row:any=g;const arr=by.get(row.physical_card_id)??[];arr.push({position:row.position,definition:row.game_definitions});by.set(row.physical_card_id,arr)}}
  return base.map(c=>({...c,games:by.get(c.id)??[]})) as PhysicalCardView[]
}

export async function voidPhysicalCard(cardId:string,reason:string){const {error}=await supabase.rpc('void_physical_card',{target_card_id:cardId,reason});if(error)throw error}
export async function registerPrint(batchId:string,cardIds:string[]){for(let start=0;start<cardIds.length;start+=300){const {error}=await supabase.rpc('register_card_print',{target_batch_id:batchId,target_card_ids:cardIds.slice(start,start+300)});if(error)throw error}}
