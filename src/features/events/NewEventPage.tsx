import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useWorkspace } from '@/app/providers/WorkspaceProvider'
import { Card } from '@/components/ui/Card'
import { EventForm } from './EventForm'
import { createEvent } from './eventService'
import type { EventFormValues } from './eventSchema'

export function NewEventPage() {
  const { currentWorkspace } = useWorkspace(); const navigate = useNavigate()
  const [busy,setBusy]=useState(false); const [error,setError]=useState<string|null>(null)
  async function submit(values:EventFormValues){ if(!currentWorkspace)return; setBusy(true);setError(null);try{const id=await createEvent(currentWorkspace.id,values);navigate(`/eventos/${id}`)}catch(e:any){setError(e?.message?.includes('slug')?'Esse identificador já está sendo usado neste organizador.':'Não foi possível criar o evento.')}finally{setBusy(false)} }
  return <div className="mx-auto max-w-4xl space-y-6"><div><p className="text-sm font-semibold text-emerald-700">Novo evento</p><h1 className="mt-1 text-3xl font-black">Criar bingo</h1><p className="mt-2 text-sm text-slate-600">Os dados abaixo formam a base que cartelas, vendas e sorteios usarão.</p></div>{error&&<div className="rounded-2xl bg-red-50 p-4 text-sm font-medium text-red-700">{error}</div>}<Card><EventForm onSubmit={submit} busy={busy} submitLabel="Criar evento"/></Card></div>
}
