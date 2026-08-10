import {supabase} from '@/services/supabase/client'
import type {EventOperationalHealth} from '@/domain/operations/health'

export async function getEventOperationalHealth(eventId:string):Promise<EventOperationalHealth>{
  const {data,error}=await supabase.rpc('get_event_operational_health',{target_event_id:eventId})
  if(error) throw error
  return data as EventOperationalHealth
}
