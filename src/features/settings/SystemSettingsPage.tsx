import { Card } from '@/components/ui/Card'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { getRuntimeConfig } from '@/lib/env'
import type { ReactNode } from 'react'

export function SystemSettingsPage() {
  const online = useOnlineStatus()
  const config = getRuntimeConfig()
  const standalone = window.matchMedia('(display-mode: standalone)').matches
  return <div className="space-y-6"><div><h1 className="text-2xl font-bold">Sistema</h1><p className="mt-1 text-sm text-slate-600">Diagnóstico rápido da instalação e conexão.</p></div>
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      <Status title="Internet" value={online?'Conectado':'Offline'} ok={online}/>
      <Status title="Modo PWA" value={standalone?'Instalado':'Navegador'} ok={standalone}/>
      <Status title="Supabase" value={config.supabaseConfigured?'Configurado':'Não configurado'} ok={config.supabaseConfigured}/>
    </div>
    <Card className="p-6"><h2 className="font-bold">Antes de um bingo</h2><div className="mt-4 grid gap-3 text-sm text-slate-700 sm:grid-cols-2"><Check>Internet estável no operador e no painel público</Check><Check>Evento, cartelas e vendas conferidos</Check><Check>TV/projetor testado em tela cheia</Check><Check>Dispositivo conectado à energia</Check><Check>Não atualizar o PWA durante o sorteio</Check><Check>Fazer um sorteio de teste antes de abrir a rodada oficial</Check></div></Card>
    <Card className="p-6"><h2 className="font-bold">Comportamento offline</h2><p className="mt-2 text-sm leading-6 text-slate-600">O PWA pode abrir com recursos armazenados no dispositivo, mas vendas, sorteio sincronizado, conferência e painel em outro dispositivo dependem de conexão com o Supabase. O sistema não apresenta o modo offline como se fosse uma operação sincronizada.</p></Card>
  </div>
}
function Status({title,value,ok}:{title:string;value:string;ok:boolean}){return <Card className="p-5"><p className="text-sm text-slate-500">{title}</p><p className={`mt-2 text-lg font-bold ${ok?'text-emerald-700':'text-amber-700'}`}>{value}</p></Card>}
function Check({children}:{children:ReactNode}){return <div className="flex gap-2"><span aria-hidden="true">✓</span><span>{children}</span></div>}
