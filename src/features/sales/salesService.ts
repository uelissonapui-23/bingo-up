import { supabase } from '@/services/supabase/client'
import type { BingoEvent, EventSettings, PhysicalCard, Sale, SaleItem, SaleStatus } from '@/types/database'

export type SalesEventOption=Pick<BingoEvent,'id'|'name'|'status'|'starts_at'> & {settings:Pick<EventSettings,'currency'|'default_card_price'|'allow_reservations'|'require_buyer_name'|'require_buyer_phone'|'require_buyer_email'|'reservation_minutes'>}
export type SaleView=Sale&{items:Array<SaleItem&{card:Pick<PhysicalCard,'id'|'code'|'sequence_number'|'status'>}>}

export async function listSalesEvents(workspaceId:string){
  const {data,error}=await supabase.from('events').select('id,name,status,starts_at,event_settings!inner(currency,default_card_price,allow_reservations,require_buyer_name,require_buyer_phone,require_buyer_email,reservation_minutes)').eq('workspace_id',workspaceId).neq('status','archived').order('created_at',{ascending:false})
  if(error)throw error
  return (data??[]).map((r:any)=>({...r,settings:r.event_settings})) as SalesEventOption[]
}

export async function expireReservations(eventId:string){const {error}=await supabase.rpc('expire_event_reservations',{target_event_id:eventId});if(error)throw error}

export async function listSaleableCards(workspaceId:string,eventId:string,filters?:{search?:string;fromSequence?:number;toSequence?:number;limit?:number}){
  await expireReservations(eventId)
  let q=supabase.from('physical_cards').select('*').eq('workspace_id',workspaceId).eq('event_id',eventId).eq('status','available').order('sequence_number').limit(filters?.limit??250)
  if(filters?.search)q=q.ilike('code',`%${filters.search.replace(/[%_]/g,'')}%`)
  if(filters?.fromSequence!=null)q=q.gte('sequence_number',filters.fromSequence)
  if(filters?.toSequence!=null)q=q.lte('sequence_number',filters.toSequence)
  const {data,error}=await q;if(error)throw error;return (data??[]) as PhysicalCard[]
}

export async function getSalesSummary(workspaceId:string,eventId:string){
  await expireReservations(eventId)
  const [{data:cards,error:ce},{data:sales,error:se}]=await Promise.all([
    supabase.from('physical_cards').select('status').eq('workspace_id',workspaceId).eq('event_id',eventId),
    supabase.from('sales').select('status,total_amount').eq('workspace_id',workspaceId).eq('event_id',eventId)
  ])
  if(ce)throw ce;if(se)throw se
  const counts={available:0,reserved:0,sold:0,canceled:0,void:0};for(const c of cards??[]){const k=(c as any).status as keyof typeof counts;if(k in counts)counts[k]++}
  let completedAmount=0;let completedSales=0;for(const s of sales??[]){if((s as any).status==='completed'){completedSales++;completedAmount+=Number((s as any).total_amount||0)}}
  return {...counts,totalCards:(cards??[]).length,completedAmount,completedSales}
}

export async function listEventSales(workspaceId:string,eventId:string,status?:SaleStatus){
  await expireReservations(eventId)
  let q=supabase.from('sales').select('*, sale_items!inner(*, physical_cards!inner(id,code,sequence_number,status))').eq('workspace_id',workspaceId).eq('event_id',eventId).order('created_at',{ascending:false}).limit(200)
  if(status)q=q.eq('status',status)
  const {data,error}=await q;if(error)throw error
  return (data??[]).map((s:any)=>({...s,items:(s.sale_items??[]).map((i:any)=>({...i,card:i.physical_cards}))})) as SaleView[]
}

export async function createCardSale(input:{eventId:string;cardIds:string[];buyerName:string;buyerPhone:string;buyerEmail:string;buyerNotes:string;unitPrice:number;reserveOnly:boolean}){
  const {data,error}=await supabase.rpc('create_card_sale',{target_event_id:input.eventId,target_card_ids:input.cardIds,buyer_name:input.buyerName||null,buyer_phone:input.buyerPhone||null,buyer_email:input.buyerEmail||null,buyer_notes:input.buyerNotes||null,unit_price:input.unitPrice,reserve_only:input.reserveOnly});if(error)throw error;return data as string
}
export async function completeReservedSale(saleId:string){const {error}=await supabase.rpc('complete_reserved_sale',{target_sale_id:saleId});if(error)throw error}
export async function cancelSale(saleId:string,reason?:string){const {error}=await supabase.rpc('cancel_sale',{target_sale_id:saleId,reason:reason||null});if(error)throw error}
