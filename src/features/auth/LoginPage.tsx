import { useState, type FormEvent } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'
import { supabase } from '@/services/supabase/client'
import { useAuth } from '@/app/providers/AuthProvider'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { AuthFrame } from './RegisterPage'
import {authReturnQuery,normalizeAuthReturnPath} from './authReturn'

export function LoginPage() {
  const { user } = useAuth(); const [searchParams] = useSearchParams()
  const emailConfirmed = searchParams.get('emailConfirmado') === '1'
  const next=normalizeAuthReturnPath(searchParams.get('next'))
  const [email, setEmail] = useState(''); const [password, setPassword] = useState('')
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false)
  if (user) return <Navigate to={next??'/acessos'} replace />
  async function submit(e: FormEvent) { e.preventDefault(); setBusy(true); setError(''); const { error } = await supabase.auth.signInWithPassword({ email, password }); if (error) setError('Não foi possível entrar. Confira e-mail e senha.'); setBusy(false) }
  return <AuthFrame title="Entrar no BINGOUP" subtitle="Uma conta para organizar, vender, operar e acompanhar suas cartelas"><form onSubmit={submit} className="space-y-4">{emailConfirmed && <p className="rounded-2xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">E-mail confirmado com sucesso. Agora entre com seu e-mail e senha.</p>}{next?.startsWith('/convites/')&&<p className="rounded-2xl border border-sky-800/60 bg-sky-950/30 p-4 text-sm font-semibold text-sky-200">Entre ou crie sua conta para continuar o convite. Depois do login você voltará automaticamente para aceitar o acesso.</p>}<label className="block text-sm font-medium">E-mail<Input className="mt-1" type="email" autoComplete="email" required value={email} onChange={e=>setEmail(e.target.value)} /></label><label className="block text-sm font-medium">Senha<Input className="mt-1" type="password" autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)} /></label>{error && <p role="alert" className="text-sm text-red-700">{error}</p>}<Button className="w-full" type="submit" disabled={busy}>{busy ? 'Entrando...' : 'Entrar'}</Button><div className="flex items-center justify-between gap-3 text-sm"><Link className="font-semibold" to="/esqueci-senha">Esqueci a senha</Link><Link className="font-semibold" to={`/criar-conta${authReturnQuery(next)}`}>Criar conta</Link></div><div className="border-t border-slate-700/60 pt-4 text-center"><Link className="text-sm font-bold text-slate-300" to="/apresentacao">Conheça o BINGOUP e os planos</Link></div></form></AuthFrame>
}
