import { Link } from 'react-router-dom'

type Step='config'|'generate'|'cards'|'sales'|'draw'|'history'
const actions:Array<{key:Step;label:string;href:(id:string)=>string}>=[
  {key:'config',label:'Configurar cartela',href:id=>`/eventos/${id}/cartelas/configuracao?aba=layouts`},
  {key:'generate',label:'Gerar cartelas',href:id=>`/eventos/${id}/cartelas/gerar`},
  {key:'cards',label:'Cartelas / PDF',href:id=>`/eventos/${id}/cartelas`},
  {key:'sales',label:'Vendas',href:id=>`/eventos/${id}/vendas`},
  {key:'draw',label:'Sorteio',href:id=>`/eventos/${id}/sorteio`},
  {key:'history',label:'Histórico',href:id=>`/eventos/${id}/historico`},
]

/**
 * Navegação rápida do evento. Não representa progresso persistido.
 * Cada tela destaca apenas a área em que o usuário está agora.
 */
export function EventFlowNav({eventId,current}:{eventId:string;current?:Step}){
  return <div className="rounded-2xl border border-slate-700 bg-slate-900/55 p-3">
    <div className="mb-2 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
      <p className="text-xs font-black uppercase tracking-[.14em] text-slate-400">Atalhos do evento</p>
      <p className="text-xs text-slate-500">Vá direto para a área que precisa. Não é uma barra de progresso.</p>
    </div>
    <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:thin]">
      {actions.map(action=><Link key={action.key} to={action.href(eventId)} className={`shrink-0 rounded-xl border px-3 py-2 text-center text-xs font-bold transition ${current===action.key?'border-red-500 bg-red-950/35 text-red-200':'border-slate-700 bg-slate-950/30 text-slate-300 hover:border-slate-500 hover:bg-slate-800/70'}`}>{action.label}</Link>)}
    </div>
  </div>
}
