export type OperationalLevel='ready'|'attention'|'critical'

export type EventOperationalHealth={
  overall:OperationalLevel
  server_time:string
  event_id:string
  event_status:string
  settings_ok:boolean
  isolation_ok:boolean
  workspace_mismatches:number
  active_rules:number
  active_templates:number
  completed_batches:number
  cards_issued:number
  cards_sold:number
  open_draws:number
  pending_candidates:number
  winners:number
  last_activity_at:string|null
  checks:Array<{code:string;level:'ok'|'warning'|'critical';label:string;detail:string}>
}

export function countChecks(health:EventOperationalHealth){
  return health.checks.reduce((acc,check)=>{
    acc[check.level]+=1
    return acc
  },{ok:0,warning:0,critical:0})
}
