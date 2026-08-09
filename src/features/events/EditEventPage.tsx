import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useWorkspace } from '@/app/providers/WorkspaceProvider'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EventForm } from './EventForm'
import { getEvent, updateEvent } from './eventService'
import { toLocalDateTimeInput } from './eventUtils'
import type { EventFormValues } from './eventSchema'
import type { EventWithSettings } from '@/types/database'

export function EditEventPage(){const {eventId}=useParams();const {currentWorkspace}=useWorkspace();const navigate=useNavigate();const [event,setEvent]=useState<EventWithSettings|null>(null);const [busy,setBusy]=useState(false);const [error,setError]=useState<string|null>(null)
useEffect(()=>{if(!currentWorkspace||!eventId)return;void getEvent(currentWorkspace.id,eventId).then(setEvent).catch(()=>setError('Evento não encontrado ou sem permissão.'))},[currentWorkspace,eventId])
if(error)return <div className="space-y-4"><div className="rounded-2xl bg-red-50 p-4 text-red-700">{error}</div><Link to="/eventos"><Button variant="secondary">Voltar</Button></Link></div>
if(!event)return <Card>Carregando evento…</Card>
const initial:Partial<EventFormValues>={name:event.name,slug:event.slug,description:event.description??'',location_name:event.location_name??'',address:event.address??'',starts_at:toLocalDateTimeInput(event.starts_at),ends_at:toLocalDateTimeInput(event.ends_at),sales_open_at:toLocalDateTimeInput(event.sales_open_at),sales_close_at:toLocalDateTimeInput(event.sales_close_at),default_card_price:Number(event.settings.default_card_price)}
async function submit(values:EventFormValues){if(!currentWorkspace||!eventId)return;setBusy(true);setError(null);try{await updateEvent(currentWorkspace.id,eventId,values);navigate(`/eventos/${eventId}`)}catch{setError('Não foi possível salvar as alterações.')}finally{setBusy(false)}}
return <div className="mx-auto max-w-4xl space-y-6"><div><p className="text-sm font-semibold text-emerald-700">Editar evento</p><h1 className="mt-1 text-3xl font-black">{event.name}</h1></div>{error&&<div className="rounded-2xl bg-red-50 p-4 text-red-700">{error}</div>}<Card><EventForm initialValues={initial} onSubmit={submit} busy={busy}/></Card></div>}
