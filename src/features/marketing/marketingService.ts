import {supabase} from '@/services/supabase/client'

export type PublicMarketingPlan={code:string;name:string;description:string|null;event_limit:number|null;price_cents:number|null;billing_label:string|null}
export type PublicMarketingData={whatsapp_number:string|null;whatsapp_message:string|null;support_phone:string|null;plans:PublicMarketingPlan[]}

export async function getPublicMarketingData():Promise<PublicMarketingData>{
  const {data,error}=await supabase.rpc('get_public_marketing_data')
  if(error)throw error
  return (data??{whatsapp_number:null,whatsapp_message:null,support_phone:null,plans:[]}) as PublicMarketingData
}
