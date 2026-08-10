import { useState } from 'react'
import { OfflineBanner } from '@/components/ui/OfflineBanner'
import { Navigate, NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '@/app/providers/AuthProvider'
import { useWorkspace } from '@/app/providers/WorkspaceProvider'
import { Button } from '@/components/ui/Button'
import { PwaStatus } from '@/components/ui/PwaStatus'

const organizerNav = [
  ['/', 'Início', 'home'],
  ['/eventos', 'Eventos', 'calendar'],
  ['/cartelas', 'Cartelas', 'grid'],
  ['/vendedores', 'Vendedores', 'users'],
  ['/operadores', 'Operadores', 'operator'],
  ['/vendas', 'Vendas', 'cart'],
  ['/sorteio', 'Sorteio', 'dice'],
  ['/historico', 'Histórico', 'clock'],
  ['/configuracoes', 'Configurações', 'settings'],
] as const

const sellerNav = [
  ['/vendas', 'Vendas', 'cart'],
  ['/configuracoes', 'Configurações', 'settings'],
] as const

const operatorNav = [
  ['/sorteio', 'Sorteio', 'dice'],
  ['/configuracoes', 'Configurações', 'settings'],
] as const

const bottomOrganizerNav = organizerNav.filter(([path]) => ['/', '/eventos', '/cartelas', '/vendas'].includes(path))

export function AppShell() {
  const { signOut } = useAuth()
  const { currentWorkspace, workspaces, selectWorkspace } = useWorkspace()
  const [menuOpen, setMenuOpen] = useState(false)
  const location=useLocation()
  const isSeller=currentWorkspace?.membership.role==='seller'
  const isOperator=currentWorkspace?.membership.role==='draw_operator'
  const mainNav=isSeller?sellerNav:isOperator?operatorNav:organizerNav
  const bottomNav=isSeller?sellerNav:isOperator?operatorNav:bottomOrganizerNav
  const operatorPathAllowed=!isOperator||location.pathname==='/sorteio'||location.pathname==='/configuracoes'||/^\/eventos\/[^/]+\/(sorteio|painel-publico\/configuracao)$/.test(location.pathname)
  if(!operatorPathAllowed)return <Navigate to="/sorteio" replace/>

  return <>
    <OfflineBanner />
    <PwaStatus />
    <div className="bingoup-app min-h-dvh">
      <aside className="bingoup-sidebar hidden xl:flex">
        <NavLink to="/" className="bingoup-brand">
          <img src="/brand/bingoup-logo-dark.png" alt="BINGOUP" />
        </NavLink>
        <nav className="bingoup-side-nav">
          {mainNav.map(([path, label, icon]) => (
            <NavLink key={path} to={path} end={path === '/'} className={({ isActive }) => navClass(isActive)}>
              <NavIcon name={icon} /><span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="bingoup-workspace-card">
          <div className="bingoup-avatar">{initials(currentWorkspace?.name)}</div>
          <div className="min-w-0"><p>{isOperator?'Operação ativa':'Organizador ativo'}</p><strong>{currentWorkspace?.name ?? 'BINGOUP'}</strong></div>
        </div>
      </aside>

      <div className="min-w-0 xl:pl-[280px]">
        <header className="bingoup-topbar">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              className="bingoup-menu-button xl:hidden"
              aria-label="Abrir menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen(true)}
            >
              <span></span><span></span><span></span>
            </button>
            <NavLink to="/" className="min-w-0 xl:hidden">
              <img className="bingoup-top-logo" src="/brand/bingoup-logo-dark.png" alt="BINGOUP" />
            </NavLink>
          </div>
          <div className="bingoup-top-actions">
            <span className="bingoup-phase">Fase 12</span>
            <div className="hidden min-w-0 text-right sm:block">
              <p className="truncate text-sm font-bold text-white">{currentWorkspace?.name}</p>
              <p className="text-xs text-slate-400">{isSeller?'Vendedor':isOperator?'Operador de sorteio':'Organizador'}</p>
            </div>
            <Button variant="secondary" onClick={() => void signOut()}>Sair</Button>
          </div>
        </header>

        <main className="bingoup-main"><Outlet /></main>
      </div>

      {menuOpen && <div className="bingoup-drawer-layer xl:hidden" role="presentation" onClick={() => setMenuOpen(false)}>
        <aside className="bingoup-drawer" role="dialog" aria-modal="true" aria-label="Menu principal" onClick={event => event.stopPropagation()}>
          <div className="bingoup-drawer-head">
            <img src="/brand/bingoup-logo-dark.png" alt="BINGOUP" />
            <button type="button" className="bingoup-drawer-close" onClick={() => setMenuOpen(false)} aria-label="Fechar menu">×</button>
          </div>
          <nav className="bingoup-side-nav">
            {mainNav.map(([path, label, icon]) => (
              <NavLink key={path} to={path} end={path === '/'} onClick={() => setMenuOpen(false)} className={({ isActive }) => navClass(isActive)}>
                <NavIcon name={icon} /><span>{label}</span>
              </NavLink>
            ))}
          </nav>
          <div className="bingoup-workspace-card">
            <div className="bingoup-avatar">{initials(currentWorkspace?.name)}</div>
            <div className="min-w-0 flex-1"><p>Espaço ativo</p><strong>{currentWorkspace?.name ?? 'BINGOUP'}</strong>{workspaces.length>1&&<select aria-label="Trocar organizador" className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-200" value={currentWorkspace?.id??''} onChange={e=>void selectWorkspace(e.target.value)}>{workspaces.map(w=><option key={w.id} value={w.id}>{w.name}</option>)}</select>}</div>
          </div>
        </aside>
      </div>}

      <nav className="bingoup-mobile-nav md:hidden" aria-label="Atalhos principais">
        {bottomNav.map(([path, label, icon]) => (
          <NavLink key={path} to={path} end={path === '/'} className={({ isActive }) => `bingoup-mobile-link ${isActive ? 'is-active' : ''}`}>
            <NavIcon name={icon} /><span>{label}</span>
          </NavLink>
        ))}
        <button type="button" className="bingoup-mobile-link" onClick={() => setMenuOpen(true)} aria-label="Abrir mais opções">
          <NavIcon name="menu" /><span>Mais</span>
        </button>
      </nav>
    </div>
  </>
}

function navClass(active: boolean) { return `bingoup-nav-link ${active ? 'is-active' : ''}` }
function initials(name?: string | null) { return (name ?? 'B').trim().split(/\s+/).slice(0, 2).map(p => p[0]?.toUpperCase()).join('') || 'B' }

function NavIcon({ name }: { name: string }) {
  const paths: Record<string, string> = {
    home: 'M3 10.8 12 3l9 7.8V21h-6v-6H9v6H3V10.8Z',
    calendar: 'M6 2v3m12-3v3M4 8h16M5 4h14a2 2 0 0 1 2 2v14H3V6a2 2 0 0 1 2-2Z',
    grid: 'M4 4h6v6H4V4Zm10 0h6v6h-6V4ZM4 14h6v6H4v-6Zm10 0h6v6h-6v-6Z',
    cart: 'M3 4h2l2.4 10.2a2 2 0 0 0 2 1.5h7.8a2 2 0 0 0 2-1.6L21 7H6m4 12h.01M17 19h.01',
    dice: 'M6 3h12a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3Zm3 6h.01M15 9h.01M9 15h.01M15 15h.01M12 12h.01',
    clock: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Zm0-15v5l3.5 2',
    settings: 'M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm7.4-3.5c0-.5-.05-.95-.14-1.4l2.02-1.57-2-3.46-2.45.98a8.1 8.1 0 0 0-2.42-1.4L14 2.5h-4l-.4 2.65a8.1 8.1 0 0 0-2.42 1.4l-2.45-.98-2 3.46 2.02 1.57A7.4 7.4 0 0 0 4.6 12c0 .5.05.95.14 1.4l-2.02 1.57 2 3.46 2.45-.98a8.1 8.1 0 0 0 2.42 1.4L10 21.5h4l.4-2.65a8.1 8.1 0 0 0 2.42-1.4l2.45.98 2-3.46-2.02-1.57c.1-.45.15-.9.15-1.4Z',
    menu: 'M4 6h16M4 12h16M4 18h16',
    users: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m7-10a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm13 10v-2a4 4 0 0 0-3-3.87m0-7.26a4 4 0 0 1 0 7.75',
    operator: 'M12 3a9 9 0 1 0 9 9M12 7v5l3 2M18 4v4h-4',
  }
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d={paths[name]} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
}
