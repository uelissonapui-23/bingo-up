import { useEffect, useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { OfflineBanner } from '@/components/ui/OfflineBanner'
import { useAuth } from '@/app/providers/AuthProvider'
import { useWorkspace } from '@/app/providers/WorkspaceProvider'
import { Button } from '@/components/ui/Button'
import { PwaStatus } from '@/components/ui/PwaStatus'

const mainNav = [
  ['/', 'Início', 'home'], ['/eventos', 'Eventos', 'calendar'], ['/cartelas', 'Cartelas', 'grid'], ['/vendas', 'Vendas', 'cart'], ['/sorteio', 'Sorteio', 'dice'], ['/historico', 'Histórico', 'clock'], ['/configuracoes', 'Configurações', 'settings']
] as const
const mobilePrimary = new Set(['/', '/eventos', '/vendas', '/sorteio', '/historico'])

export function AppShell() {
  const { signOut } = useAuth()
  const { currentWorkspace } = useWorkspace()
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    if (!menuOpen) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setMenuOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => { document.body.style.overflow = previous; window.removeEventListener('keydown', onKey) }
  }, [menuOpen])

  return <><OfflineBanner/><PwaStatus/><div className="bingoup-app min-h-dvh">
    <aside className="bingoup-sidebar hidden lg:flex">
      <NavLink to="/" className="bingoup-brand"><img src="/brand/bingoup-logo-dark.png" alt="BINGOUP" /></NavLink>
      <nav className="bingoup-side-nav">{mainNav.map(([path,label,icon])=><NavLink key={path} to={path} end={path==='/' } className={({isActive})=>navClass(isActive)}><NavIcon name={icon}/><span>{label}</span></NavLink>)}</nav>
      <div className="bingoup-workspace-card"><div className="bingoup-avatar">{initials(currentWorkspace?.name)}</div><div className="min-w-0"><p>Organizador ativo</p><strong>{currentWorkspace?.name ?? 'BINGOUP'}</strong></div></div>
    </aside>
    <div className="min-w-0 lg:pl-[280px]">
      <header className="bingoup-topbar">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3"><button type="button" className="bingoup-menu-button lg:hidden" aria-label="Abrir menu" aria-expanded={menuOpen} onClick={()=>setMenuOpen(true)}><NavIcon name="menu"/></button><NavLink to="/" className="min-w-0 lg:hidden"><img className="bingoup-top-logo" src="/brand/bingoup-logo-dark.png" alt="BINGOUP"/></NavLink></div>
        <div className="flex min-w-0 items-center gap-2 sm:gap-3"><span className="bingoup-phase hidden min-[390px]:inline-flex">Fase 12</span><div className="hidden min-w-0 text-right sm:block"><p className="max-w-44 truncate text-sm font-bold text-white">{currentWorkspace?.name}</p><p className="text-xs text-slate-400">Organizador</p></div><Button className="px-3 sm:px-4" variant="secondary" onClick={()=>void signOut()}>Sair</Button></div>
      </header>
      <main className="bingoup-main"><div className="bingoup-content"><Outlet/></div></main>
    </div>
    <nav className="bingoup-mobile-nav lg:hidden">{mainNav.filter(([path])=>mobilePrimary.has(path)).map(([path,label,icon])=><NavLink key={path} to={path} end={path==='/' } className={({isActive})=>`bingoup-mobile-link ${isActive?'is-active':''}`}><NavIcon name={icon}/><span>{label}</span></NavLink>)}</nav>
    {menuOpen && <div className="bingoup-drawer-layer lg:hidden" role="presentation" onMouseDown={(event)=>{if(event.currentTarget===event.target)setMenuOpen(false)}}><aside className="bingoup-drawer" role="dialog" aria-modal="true" aria-label="Menu principal"><div className="bingoup-drawer-head"><img src="/brand/bingoup-logo-dark.png" alt="BINGOUP"/><button type="button" className="bingoup-menu-button" aria-label="Fechar menu" onClick={()=>setMenuOpen(false)}>×</button></div><nav className="bingoup-side-nav">{mainNav.map(([path,label,icon])=><NavLink key={path} to={path} end={path==='/' } onClick={()=>setMenuOpen(false)} className={({isActive})=>navClass(isActive)}><NavIcon name={icon}/><span>{label}</span></NavLink>)}</nav><div className="mt-auto space-y-3"><div className="bingoup-workspace-card"><div className="bingoup-avatar">{initials(currentWorkspace?.name)}</div><div className="min-w-0"><p>Organizador ativo</p><strong>{currentWorkspace?.name ?? 'BINGOUP'}</strong></div></div><Button className="w-full" variant="secondary" onClick={()=>void signOut()}>Sair da conta</Button></div></aside></div>}
  </div></>
}
function navClass(active:boolean){return `bingoup-nav-link ${active?'is-active':''}`}
function initials(name?:string|null){return (name??'B').trim().split(/\s+/).slice(0,2).map(part=>part[0]?.toUpperCase()).join('')||'B'}
function NavIcon({name}:{name:string}){const paths:Record<string,string>={home:'M3 10.8 12 3l9 7.8V21h-6v-6H9v6H3V10.8Z',calendar:'M6 2v3m12-3v3M4 8h16M5 4h14a2 2 0 0 1 2 2v14H3V6a2 2 0 0 1 2-2Z',grid:'M4 4h6v6H4V4Zm10 0h6v6h-6V4ZM4 14h6v6H4v-6Zm10 0h6v6h-6v-6Z',cart:'M3 4h2l2.4 10.2a2 2 0 0 0 2 1.5h7.8a2 2 0 0 0 2-1.6L21 7H6m4 12h.01M17 19h.01',dice:'M6 3h12a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3Zm3 6h.01M15 9h.01M9 15h.01M15 15h.01M12 12h.01',clock:'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Zm0-15v5l3.5 2',settings:'M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm7.4-3.5c0-.5-.05-.95-.14-1.4l2.02-1.57-2-3.46-2.45.98a8.1 8.1 0 0 0-2.42-1.4L14 2.5h-4l-.4 2.65a8.1 8.1 0 0 0-2.42 1.4l-2.45-.98-2 3.46 2.02 1.57A7.4 7.4 0 0 0 4.6 12c0 .5.05.95.14 1.4l-2.02 1.57 2 3.46 2.45-.98a8.1 8.1 0 0 0 2.42 1.4L10 21.5h4l.4-2.65a8.1 8.1 0 0 0 2.42-1.4l2.45.98 2-3.46-2.02-1.57c.1-.45.15-.9.15-1.4Z',menu:'M4 7h16M4 12h16M4 17h16'};return <svg viewBox="0 0 24 24" aria-hidden="true"><path d={paths[name]} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
