import { useEffect, useState, type FormEvent } from 'react'
import { supabase } from '@/services/supabase/client'
import { useAuth } from '@/app/providers/AuthProvider'
import { useWorkspace } from '@/app/providers/WorkspaceProvider'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { toSlug } from '@/utils/slug'
import { Link } from 'react-router-dom'

export function AccountPage() {
  const { user } = useAuth(); const { currentWorkspace, refresh } = useWorkspace()
  const [displayName, setDisplayName] = useState(''); const [phone, setPhone] = useState('')
  const [workspaceName, setWorkspaceName] = useState(''); const [workspaceSlug, setWorkspaceSlug] = useState('')
  const [profileBusy, setProfileBusy] = useState(false); const [workspaceBusy, setWorkspaceBusy] = useState(false); const [message, setMessage] = useState('')

  useEffect(() => { void (async () => { if (!user) return; const { data } = await supabase.from('profiles').select('display_name,phone').eq('id', user.id).single(); setDisplayName(data?.display_name ?? ''); setPhone(data?.phone ?? '') })() }, [user])
  useEffect(() => { setWorkspaceName(currentWorkspace?.name ?? ''); setWorkspaceSlug(currentWorkspace?.slug ?? '') }, [currentWorkspace])

  async function saveProfile(e: FormEvent) { e.preventDefault(); if (!user) return; setProfileBusy(true); setMessage(''); const { error } = await supabase.from('profiles').update({ display_name: displayName.trim() || null, phone: phone.trim() || null }).eq('id', user.id); setMessage(error ? 'Não foi possível salvar o perfil.' : 'Perfil atualizado.'); setProfileBusy(false) }
  async function saveWorkspace(e: FormEvent) { e.preventDefault(); if (!currentWorkspace) return; setWorkspaceBusy(true); setMessage(''); const { error } = await supabase.from('workspaces').update({ name: workspaceName.trim(), slug: toSlug(workspaceSlug) }).eq('id', currentWorkspace.id); if (!error) { await supabase.rpc('log_audit', { target_workspace_id: currentWorkspace.id, target_action: 'workspace.updated', target_entity_type: 'workspace', target_entity_id: currentWorkspace.id, target_metadata: { name: workspaceName.trim(), slug: toSlug(workspaceSlug) } }); await refresh() } setMessage(error ? 'Não foi possível atualizar o organizador.' : 'Organizador atualizado.'); setWorkspaceBusy(false) }

  return <div className="space-y-6"><div><h1 className="text-2xl font-bold">Conta e organizador</h1><p className="mt-1 text-sm text-slate-600">Dados usados em todo o sistema.</p></div>{message && <div className="rounded-2xl bg-slate-900 px-4 py-3 text-sm text-white">{message}</div>}<div className="grid gap-6 xl:grid-cols-2"><Card><form onSubmit={saveProfile} className="space-y-4 p-6"><div><h2 className="font-bold">Seu perfil</h2><p className="text-sm text-slate-600">Dados da conta do organizador.</p></div><label className="block text-sm font-medium">Nome<Input className="mt-1" value={displayName} onChange={e=>setDisplayName(e.target.value)} /></label><label className="block text-sm font-medium">Telefone<Input className="mt-1" value={phone} onChange={e=>setPhone(e.target.value)} /></label><label className="block text-sm font-medium">E-mail<Input className="mt-1" value={user?.email ?? ''} disabled /></label><Button disabled={profileBusy}>{profileBusy ? 'Salvando...' : 'Salvar perfil'}</Button></form></Card><Card><form onSubmit={saveWorkspace} className="space-y-4 p-6"><div><h2 className="font-bold">Organizador</h2><p className="text-sm text-slate-600">Espaço isolado dos seus eventos e bingos.</p></div><label className="block text-sm font-medium">Nome<Input className="mt-1" required value={workspaceName} onChange={e=>setWorkspaceName(e.target.value)} /></label><label className="block text-sm font-medium">Identificador<Input className="mt-1" required value={workspaceSlug} onChange={e=>setWorkspaceSlug(toSlug(e.target.value))} /></label><Button disabled={workspaceBusy}>{workspaceBusy ? 'Salvando...' : 'Salvar organizador'}</Button></form></Card></div><Card className="p-6"><h2 className="font-bold">Aplicativo e diagnóstico</h2><p className="mt-1 text-sm text-slate-600">Confira instalação PWA, conexão e checklist antes de um evento.</p><Link to="/configuracoes/sistema" className="mt-4 inline-block text-sm font-bold text-slate-900 underline">Abrir diagnóstico do sistema</Link></Card></div>
}
