import { supabase } from '@/services/supabase/client'

export type WorkspaceDashboard = {
  events_total:number; events_active:number; cards_issued:number; cards_sold:number; sales_completed:number; sales_amount:number; draw_sessions:number; winners:number
  recent_events:Array<{id:string;name:string;status:string;starts_at:string|null;created_at:string;cards_issued:number;cards_sold:number;sales_amount:number;winners:number}>
}
export type EventReport = {
  event:{id:string;name:string;status:string;starts_at:string|null;ends_at:string|null}
  cards:{issued:number;available:number;reserved:number;sold:number;canceled:number}
  sales:{completed:number;reserved:number;canceled:number;amount:number;average_ticket:number}
  draws:{total:number;finished:number;called_numbers:number}
  winners:number
  sessions:Array<{id:string;session_number:number;name:string;status:string;win_pattern_code:string;participant_cards:number;participant_games:number;called_count:number;started_at:string;finished_at:string|null;winners:number}>
  sales_by_day:Array<{day:string;sales_count:number;amount:number}>
}

export async function getWorkspaceDashboard(workspaceId:string):Promise<WorkspaceDashboard>{
  const {data,error}=await supabase.rpc('get_workspace_dashboard',{target_workspace_id:workspaceId})
  if(error) throw error
  return data as WorkspaceDashboard
}
export async function getEventReport(eventId:string):Promise<EventReport>{
  const {data,error}=await supabase.rpc('get_event_report',{target_event_id:eventId})
  if(error) throw error
  return data as EventReport
}

export function eventReportCsv(report:EventReport){
  const rows=[
    ['Relatório do evento',report.event.name],
    ['Status',report.event.status],
    ['Cartelas emitidas',report.cards.issued],['Cartelas vendidas',report.cards.sold],['Cartelas disponíveis',report.cards.available],['Cartelas reservadas',report.cards.reserved],
    ['Vendas concluídas',report.sales.completed],['Total vendido',report.sales.amount],['Ticket médio',report.sales.average_ticket],
    ['Sessões de sorteio',report.draws.total],['Sessões finalizadas',report.draws.finished],['Números chamados',report.draws.called_numbers],['Vencedores',report.winners],
    [],['Sessões'],['Número','Nome','Status','Padrão','Cartelas','Jogos','Bolas chamadas','Vencedores','Início','Fim'],
    ...report.sessions.map(s=>[s.session_number,s.name,s.status,s.win_pattern_code,s.participant_cards,s.participant_games,s.called_count,s.winners,s.started_at,s.finished_at??'']),
    [],['Vendas por dia'],['Data','Vendas','Valor'],...report.sales_by_day.map(d=>[d.day,d.sales_count,d.amount])
  ]
  return rows.map(row=>row.map(cell=>`"${String(cell??'').replaceAll('"','""')}"`).join(';')).join('\n')
}
export function downloadCsv(filename:string,content:string){
  const blob=new Blob(['\uFEFF'+content],{type:'text/csv;charset=utf-8'})
  const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=filename;a.click();URL.revokeObjectURL(url)
}
