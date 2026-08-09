import { OfflineBanner } from '@/components/ui/OfflineBanner'
import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '@/app/providers/AuthProvider'
import { useWorkspace } from '@/app/providers/WorkspaceProvider'
import { Button } from '@/components/ui/Button'
import { PwaStatus } from '@/components/ui/PwaStatus'

const mainNav = [
  ['/', 'Início'], ['/eventos', 'Eventos'], ['/cartelas', 'Cartelas'], ['/vendas', 'Vendas'], ['/sorteio', 'Sorteio'], ['/historico', 'Histórico'], ['/configuracoes', 'Configurações']
] as const

export function AppShell() {
  const { signOut } = useAuth(); const { currentWorkspace } = useWorkspace()
  return <><OfflineBanner/><PwaStatus/><div className="min-h-dvh bg-slate-50 text-slate-950"><header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur"><div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6"><NavLink to="/" className="flex min-w-0 items-center gap-3 font-bold"><span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-slate-900 text-lg text-white">B</span><span className="truncate">{currentWorkspace?.name ?? 'Bingo PWA'}</span></NavLink><div className="flex items-center gap-2"><span className="hidden rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 sm:inline">Fase 12</span><Button variant="secondary" onClick={()=>void signOut()}>Sair</Button></div></div></header><div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[240px_minmax(0,1fr)]"><aside className="hidden lg:block"><nav className="sticky top-22 space-y-1 rounded-3xl border border-slate-200 bg-white p-3 shadow-sm">{mainNav.map(([path,label])=><NavLink key={path} to={path} end={path==='/'} className={({isActive})=>navClass(isActive)}>{label}</NavLink>)}</nav></aside><main className="min-w-0 pb-20 lg:pb-0"><Outlet/></main></div><nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-slate-200 bg-white p-2 lg:hidden">{mainNav.filter(([path])=>['/','/eventos','/vendas','/sorteio','/historico'].includes(path)).map(([path,label])=><NavLink key={path} to={path} end={path==='/'} className={({isActive})=>`rounded-xl px-1 py-2 text-center text-xs font-semibold ${isActive?'bg-slate-900 text-white':'text-slate-600'}`}>{label}</NavLink>)}</nav></div></>
}
function navClass(active:boolean){return `block rounded-2xl px-3 py-2.5 text-sm font-medium transition ${active?'bg-slate-900 text-white':'text-slate-600 hover:bg-slate-100 hover:text-slate-950'}`}
