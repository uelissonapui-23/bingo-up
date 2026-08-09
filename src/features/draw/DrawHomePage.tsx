import {useEffect,useState} from 'react'
import {Link} from 'react-router-dom'
import {useWorkspace} from '@/app/providers/WorkspaceProvider'
import {Card} from '@/components/ui/Card'
import {Button} from '@/components/ui/Button'
import {listDrawEvents} from './drawService'
import {eventStatusLabel} from '@/features/events/eventUtils'

export function DrawHomePage(){
  const {currentWorkspace}=useWorkspace();const [items,setItems]=useState<Array<{id:string;name:string;status:string;starts_at:string|null}>>([]);const [loading,setLoading]=useState(true);const [error,setError]=useState<string|null>(null)
  useEffect(()=>{if(!currentWorkspace)return;setLoading(true);listDrawEvents(currentWorkspace.id).then(setItems).catch(()=>setError('Não foi possível carregar os eventos.')).finally(()=>setLoading(false))},[currentWorkspace])
  return <div className="space-y-6"><div><p className="text-sm font-semibold text-emerald-700">Operação</p><h1 className="mt-1 text-3xl font-black tracking-tight">Sorteio</h1><p className="mt-2 text-sm text-slate-600">Abra o sorteio do evento correto. Cada evento mantém sua sessão e histórico isolados.</p></div>{error&&<div className="rounded-2xl bg-red-50 p-4 text-sm text-red-700">{error}</div>}{loading?<Card>Carregando eventos…</Card>:items.length===0?<Card>Nenhum evento disponível.</Card>:<div className="grid gap-4 md:grid-cols-2">{items.map(item=><Card key={item.id}><div className="flex items-start justify-between gap-3"><div><h2 className="font-black">{item.name}</h2><p className="mt-1 text-sm text-slate-500">{eventStatusLabel[item.status as keyof typeof eventStatusLabel]??item.status}</p></div><Link to={`/eventos/${item.id}/sorteio`}><Button>Abrir</Button></Link></div></Card>)}</div>}</div>
}
