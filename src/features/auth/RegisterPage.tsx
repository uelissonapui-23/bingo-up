import { useState, type FormEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { supabase } from '@/services/supabase/client'
import { useAuth } from '@/app/providers/AuthProvider'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { usePlatformBrand } from '@/components/brand/PlatformBrandProvider'

export function RegisterPage() {
  const { user } = useAuth()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  if (user) return <Navigate to="/" replace />

  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError(''); setMessage('')
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: name.trim() } }
    })
    if (error) setError(error.message.includes('registered') ? 'Este e-mail já possui uma conta.' : 'Não foi possível criar a conta.')
    else if (data.session) setMessage('Conta criada. Seu acesso ficará aguardando liberação da equipe responsável.')
    else setMessage('Conta criada. Confirme o e-mail; depois seu acesso ficará aguardando liberação.')
    setBusy(false)
  }

  return <AuthFrame title="Criar conta do organizador" subtitle="Crie sua conta. O acesso é liberado pela equipe responsável após a confirmação comercial.">
    <form onSubmit={submit} className="space-y-4">
      <Field label="Seu nome"><Input required autoComplete="name" value={name} onChange={e=>setName(e.target.value)} /></Field>
      <Field label="E-mail"><Input type="email" required autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} /></Field>
      <Field label="Senha"><Input type="password" required minLength={8} autoComplete="new-password" value={password} onChange={e=>setPassword(e.target.value)} /></Field>
      <p className="text-xs text-slate-500">Use pelo menos 8 caracteres.</p>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      {message && <p className="text-sm text-emerald-700">{message}</p>}
      <Button className="w-full" type="submit" disabled={busy}>{busy ? 'Criando...' : 'Criar conta'}</Button>
    </form>
    <p className="mt-5 text-center text-sm text-slate-600">Já tem conta? <Link className="font-semibold text-slate-950" to="/entrar">Entrar</Link></p>
  </AuthFrame>
}

export function AuthFrame({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  const { authLogoUrl, app_name } = usePlatformBrand()
  return <main className="bingoup-auth"><section className="bingoup-auth-card"><img className="bingoup-auth-logo" src={authLogoUrl} alt={`${app_name} - Sistema de Bingo Computadorizado`}/><div className="mb-6"><h1 className="text-2xl font-black text-white">{title}</h1><p className="mt-1 text-sm text-slate-400">{subtitle}</p></div>{children}</section></main>
}
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block text-sm font-medium text-slate-200">{label}<div className="mt-1">{children}</div></label> }
