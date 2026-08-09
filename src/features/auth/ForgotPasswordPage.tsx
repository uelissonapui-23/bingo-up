import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/services/supabase/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { AuthFrame } from './RegisterPage'

export function ForgotPasswordPage() {
  const [email, setEmail] = useState(''); const [busy, setBusy] = useState(false); const [sent, setSent] = useState(false)
  async function submit(e: FormEvent) { e.preventDefault(); setBusy(true); await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/redefinir-senha` }); setSent(true); setBusy(false) }
  return <AuthFrame title="Recuperar senha" subtitle="Enviaremos as instruções para o e-mail da conta.">
    {sent ? <div className="space-y-4"><p className="rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-800">Se o e-mail estiver cadastrado, você receberá as instruções de recuperação.</p><Link to="/entrar" className="block text-center text-sm font-semibold">Voltar para entrar</Link></div> : <form onSubmit={submit} className="space-y-4"><label className="block text-sm font-medium">E-mail<Input className="mt-1" type="email" required value={email} onChange={e=>setEmail(e.target.value)} /></label><Button className="w-full" disabled={busy}>{busy ? 'Enviando...' : 'Enviar recuperação'}</Button><Link to="/entrar" className="block text-center text-sm font-semibold">Voltar</Link></form>}
  </AuthFrame>
}
