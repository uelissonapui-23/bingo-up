import { supabase } from '@/services/supabase/client'

export type PublicPanelState = {
  session_id: string
  event_name: string
  round_name: string
  status: 'active' | 'paused' | 'finished' | 'canceled'
  total_balls: number
  called_count: number
  last_called_number: number | null
  called_numbers: number[]
  one_away: number | null
  two_away: number | null
  show_progress: boolean
  show_near_winners: boolean
  possible_bingo: boolean
  confirmed_bingo: boolean
  confirmed_winners: number
  win_pattern_name: string
  updated_at: string
}

export async function getPublicPanelState(publicToken:string):Promise<PublicPanelState>{
  const {data,error}=await supabase.rpc('get_public_panel_state',{target_public_token:publicToken})
  if(error) throw error
  return data as PublicPanelState
}

export function subscribeToPublicPanel(publicToken:string,onChange:()=>void){
  const channel=supabase.channel(`public-panel-${publicToken}`)
    .on('postgres_changes',{event:'*',schema:'public',table:'public_panel_signals',filter:`public_token=eq.${publicToken}`},onChange)
    .subscribe()
  return ()=>{void supabase.removeChannel(channel)}
}
