import { supabase } from '@/services/supabase/client'
import type { BingoRuleSet, CardTemplate, BingoDistributionMode, CardBannerPosition, CardOrientation, CardPageSize } from '@/types/database'
import type { ColumnDefinition } from '@/domain/cards/capacity'
import type { CardTemplateOptions } from '@/domain/cards/templateOptions'

export type CreateRuleInput = {
  name: string; code: string; totalBalls: number; gridRows: number; gridColumns: number; numbersPerGame: number
  freeCenter: boolean; distributionMode: BingoDistributionMode; columns: ColumnDefinition[]
  winPatterns: Array<{code:string;name:string;kind:string}>; isDefault: boolean
}
export type CreateTemplateInput = {
  name:string; format:1|2|3; layoutKey:string; orientation:CardOrientation; pageSize:CardPageSize
  bannerPosition:CardBannerPosition; bannerHeightMm:number; isDefault:boolean; options?:CardTemplateOptions
  artworkFile?:Blob; wildcardFile?:Blob
}

export async function ensureCardConfigDefaults(eventId:string){
  const {error}=await supabase.rpc('ensure_event_card_defaults',{target_event_id:eventId})
  if(!error)return
  // Uma versão antiga do inicializador podia colidir ao renomear presets já existentes.
  // Nessa situação (unique_violation / HTTP 409), a configuração já existe e a tela
  // deve continuar carregando enquanto a migration corretiva torna a RPC idempotente.
  if(error.code==='23505'){
    console.warn('Presets de cartela já existentes; continuando com a configuração atual.',error)
    return
  }
  throw error
}
export async function listRuleSets(workspaceId:string,eventId:string):Promise<BingoRuleSet[]>{
  const {data,error}=await supabase.from('bingo_rule_sets').select('*').eq('workspace_id',workspaceId).eq('event_id',eventId).order('is_default',{ascending:false}).order('created_at')
  if(error) throw error; return (data??[]) as BingoRuleSet[]
}
export async function createRuleSet(workspaceId:string,eventId:string,input:CreateRuleInput){
  const {data,error}=await supabase.rpc('create_bingo_rule_set',{target_workspace_id:workspaceId,target_event_id:eventId,rule_name:input.name,rule_code:input.code,rule_total_balls:input.totalBalls,rule_grid_rows:input.gridRows,rule_grid_columns:input.gridColumns,rule_numbers_per_game:input.numbersPerGame,rule_free_center:input.freeCenter,rule_distribution:input.distributionMode,rule_column_definitions:input.columns,rule_win_patterns:input.winPatterns,make_default:input.isDefault})
  if(error) throw error; return data as string
}
export async function setDefaultRule(ruleId:string){const {error}=await supabase.rpc('set_default_bingo_rule',{target_rule_id:ruleId});if(error)throw error}
export async function toggleRule(workspaceId:string,ruleId:string,isActive:boolean){const {error}=await supabase.from('bingo_rule_sets').update({is_active:isActive}).eq('workspace_id',workspaceId).eq('id',ruleId);if(error)throw error}

export async function listCardTemplates(workspaceId:string,eventId:string):Promise<CardTemplate[]>{
  const {data,error}=await supabase.from('card_templates').select('*').eq('workspace_id',workspaceId).eq('event_id',eventId).order('physical_format').order('is_default',{ascending:false}).order('created_at')
  if(error) throw error; return (data??[]) as CardTemplate[]
}
export async function createCardTemplate(workspaceId:string,eventId:string,input:CreateTemplateInput){
  const options:CardTemplateOptions=input.options??{version:1}
  const uploaded:string[]=[]
  try{
    if(input.artworkFile){const path=`${workspaceId}/${eventId}/artworks/${crypto.randomUUID()}.webp`;await uploadAsset(path,input.artworkFile);uploaded.push(path);options.artwork={...(options.artwork??{zoom:1,offsetX:0,offsetY:0,quality:'standard'}),path}}
    if(input.wildcardFile){const path=`${workspaceId}/${eventId}/wildcards/${crypto.randomUUID()}.webp`;await uploadAsset(path,input.wildcardFile);uploaded.push(path);options.wildcard={...(options.wildcard??{kind:'custom',scale:1}),kind:'custom',path}}
    const {data,error}=await supabase.rpc('create_card_template',{target_workspace_id:workspaceId,target_event_id:eventId,template_name:input.name,template_format:input.format,template_layout_key:input.layoutKey,template_orientation:input.orientation,template_page_size:input.pageSize,template_banner_position:input.bannerPosition,template_banner_height_mm:input.bannerHeightMm,template_options:options,make_default:input.isDefault})
    if(error)throw error
    if(input.artworkFile){const {error:updateError}=await supabase.from('card_templates').update({banner_position:'none',banner_height_mm:0,show_event_name:false,show_event_date:false,show_qr_code:false,show_series:false,show_card_code:false}).eq('id',data as string).eq('workspace_id',workspaceId);if(updateError)throw updateError}
    return data as string
  }catch(error){if(uploaded.length)await supabase.storage.from('card-artworks').remove(uploaded).catch(()=>{});throw error}
}
async function uploadAsset(path:string,file:Blob){const {error}=await supabase.storage.from('card-artworks').upload(path,file,{contentType:'image/webp',upsert:false,cacheControl:'31536000'});if(error)throw error}
export function getCardAssetUrl(path:string|undefined|null){if(!path)return null;return supabase.storage.from('card-artworks').getPublicUrl(path).data.publicUrl}
export async function setDefaultTemplate(templateId:string){const {error}=await supabase.rpc('set_default_card_template',{target_template_id:templateId});if(error)throw error}
export async function toggleTemplate(workspaceId:string,templateId:string,isActive:boolean){const {error}=await supabase.from('card_templates').update({is_active:isActive}).eq('workspace_id',workspaceId).eq('id',templateId);if(error)throw error}
