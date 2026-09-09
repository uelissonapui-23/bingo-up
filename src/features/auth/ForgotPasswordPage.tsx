import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/services/supabase/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { AuthFrame } from './RegisterPage'

export function ForgotPasswordPage() {
  const [email, setEmail] = useState(''); const [busy, setBusy] = useState(false); const [sent, setSent] = useState(false); const [error, setError] = useState('')
  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError('')
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/redefinir-senha` })
      if (error) setError(error.status === 429 ? 'Muitas tentativas. Aguarde alguns minutos e tente novamente.' : 'Não foi possível enviar a recuperação. Tente novamente em instantes.')
      else setSent(true)
    } catch {
      setError('Não foi possível conectar ao serviço de acesso. Tente novamente em instantes.')
    } finally { setBusy(false) }
  }
  return <AuthFrame title="Recuperar senha" subtitle="Enviaremos as instruções para o e-mail da conta.">
    {sent ? <div className="space-y-4"><p className="rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-800">Se o e-mail estiver cadastrado, você receberá as instruções. Verifique também a caixa de spam.</p><Link to="/entrar" className="block text-center text-sm font-semibold">Voltar para entrar</Link></div> : <form onSubmit={submit} className="space-y-4"><label className="block text-sm font-medium">E-mail<Input className="mt-1" type="email" autoComplete="email" required value={email} onChange={e=>setEmail(e.target.value)} /></label>{error && <p role="alert" className="text-sm text-red-300">{error}</p>}<Button className="w-full" type="submit" disabled={busy}>{busy ? 'Enviando...' : 'Enviar recuperação'}</Button><Link to="/entrar" className="block text-center text-sm font-semibold">Voltar</Link></form>}
  </AuthFrame>
}
