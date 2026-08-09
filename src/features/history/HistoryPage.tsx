import { useCallback,useEffect,useState } from 'react'
import { Link } from 'react-router-dom'
import { useWorkspace } from '@/app/providers/WorkspaceProvider'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { getWorkspaceDashboard,type WorkspaceDashboard } from './historyService'

export function HistoryPage(){
  const {currentWorkspace}=useWorkspace();const [data,setData]=useState<WorkspaceDashboard|null>(null);const [error,setError]=useState('');const [loading,setLoading]=useState(true)
  const load=useCallback(async()=>{if(!currentWorkspace)return;setLoading(true);setError('');try{setData(await getWorkspaceDashboard(currentWorkspace.id))}catch(e:any){setError(e?.message??'Não foi possível carregar o histórico.')}finally{setLoading(false)}},[currentWorkspace])
  useEffect(()=>{void load()},[load])
  if(loading)return <Card><p className="text-sm text-slate-600">Carregando histórico...</p></Card>
  if(error)return <Card><p className="font-semibold text-red-700">{error}</p><Button className="mt-4" onClick={()=>void load()}>Tentar novamente</Button></Card>
  if(!data)return null
  return <div className="space-y-6"><div><p className="text-sm font-semibold text-emerald-700">Histórico e relatórios</p><h1 className="mt-1 text-3xl font-black tracking-tight">Visão consolidada</h1><p className="mt-2 text-sm text-slate-600">Consulte os eventos anteriores sem misturar informações entre eventos ou organizadores.</p></div>
  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><Stat label="Eventos" value={data.events_total}/><Stat label="Cartelas vendidas" value={data.cards_sold}/><Stat label="Total vendido" value={money(data.sales_amount)}/><Stat label="Vencedores" value={data.winners}/></div>
  <Card><div className="flex items-center justify-between gap-3"><div><h2 className="font-bold">Eventos</h2><p className="text-sm text-slate-500">Abra um evento para ver vendas, sorteios, vencedores e exportar o relatório.</p></div><Link to="/eventos"><Button variant="secondary">Todos os eventos</Button></Link></div>
  <div className="mt-4 space-y-3">{data.recent_events.length===0?<p className="text-sm text-slate-500">Nenhum evento registrado.</p>:data.recent_events.map(e=><Link key={e.id} to={`/eventos/${e.id}/historico`} className="grid gap-2 rounded-2xl border border-slate-200 p-4 transition hover:bg-slate-50 sm:grid-cols-[1fr_auto]"><div><p className="font-bold">{e.name}</p><p className="mt-1 text-xs text-slate-500">{labelStatus(e.status)} · {e.starts_at?date(e.starts_at):'Sem data definida'}</p></div><div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600 sm:justify-end"><span>{e.cards_sold}/{e.cards_issued} vendidas</span><span>{money(e.sales_amount)}</span><span>{e.winners} vencedor(es)</span></div></Link>)}</div></Card></div>
}
function Stat({label,value}:{label:string;value:string|number}){return <Card><p className="text-sm text-slate-500">{label}</p><p className="mt-2 text-3xl font-black">{value}</p></Card>}
function money(v:number){return new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(v||0))}
function date(v:string){return new Intl.DateTimeFormat('pt-BR',{dateStyle:'medium',timeStyle:'short'}).format(new Date(v))}
function labelStatus(v:string){return ({draft:'Rascunho',sales_open:'Vendas abertas',sales_paused:'Vendas pausadas',ready:'Pronto',drawing:'Sorteando',paused:'Pausado',finished:'Finalizado',canceled:'Cancelado',archived:'Arquivado'} as Record<string,string>)[v]??v}
