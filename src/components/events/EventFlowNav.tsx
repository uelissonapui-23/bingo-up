import { Link } from 'react-router-dom'

type Step='config'|'generate'|'cards'|'sales'|'draw'|'history'
const steps:Array<{key:Step;label:string;short:string;href:(id:string)=>string}>=[
  {key:'config',label:'1. Configurar cartela',short:'Configurar',href:id=>`/eventos/${id}/cartelas/configuracao?aba=layouts`},
  {key:'generate',label:'2. Gerar cartelas',short:'Gerar',href:id=>`/eventos/${id}/cartelas/gerar`},
  {key:'cards',label:'3. Imprimir / PDF',short:'PDF',href:id=>`/eventos/${id}/cartelas`},
  {key:'sales',label:'4. Registrar vendas',short:'Vendas',href:id=>`/eventos/${id}/vendas`},
  {key:'draw',label:'5. Fazer sorteio',short:'Sorteio',href:id=>`/eventos/${id}/sorteio`},
  {key:'history',label:'6. Histórico',short:'Histórico',href:id=>`/eventos/${id}/historico`},
]

export function EventFlowNav({eventId,current}:{eventId:string;current?:Step}){
  return <div className="rounded-2xl border border-slate-700 bg-slate-900/55 p-3">
    <div className="mb-2 flex items-center justify-between gap-3"><p className="text-xs font-black uppercase tracking-[.14em] text-slate-400">Fluxo do evento</p><p className="hidden text-xs text-slate-500 sm:block">Siga da esquerda para a direita</p></div>
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
      {steps.map(step=><Link key={step.key} to={step.href(eventId)} className={`min-w-0 rounded-xl border px-3 py-2 text-center text-xs font-bold transition ${current===step.key?'border-red-500 bg-red-950/35 text-red-200':'border-slate-700 bg-slate-950/30 text-slate-300 hover:border-slate-500 hover:bg-slate-800/70'}`} title={step.label}><span className="hidden sm:inline">{step.label}</span><span className="sm:hidden">{step.short}</span></Link>)}
    </div>
  </div>
}
