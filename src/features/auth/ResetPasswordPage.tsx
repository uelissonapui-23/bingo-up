import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from '@/services/supabase/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { AuthFrame } from './RegisterPage'

export function ResetPasswordPage() {
  const [password, setPassword] = useState(''); const [confirm, setConfirm] = useState(''); const [busy, setBusy] = useState(false); const [done, setDone] = useState(false); const [error, setError] = useState('')
  if (done) return <Navigate to="/" replace />
  async function submit(e: FormEvent) { e.preventDefault(); setError(''); if (password.length < 8) return setError('A senha precisa ter pelo menos 8 caracteres.'); if (password !== confirm) return setError('As senhas não conferem.'); setBusy(true); const { error } = await supabase.auth.updateUser({ password }); if (error) setError('Não foi possível alterar a senha. Abra novamente o link de recuperação.'); else setDone(true); setBusy(false) }
  return <AuthFrame title="Criar nova senha" subtitle="Defina uma nova senha para sua conta."><form onSubmit={submit} className="space-y-4"><label className="block text-sm font-medium">Nova senha<Input className="mt-1" type="password" required minLength={8} value={password} onChange={e=>setPassword(e.target.value)} /></label><label className="block text-sm font-medium">Confirmar senha<Input className="mt-1" type="password" required minLength={8} value={confirm} onChange={e=>setConfirm(e.target.value)} /></label>{error && <p role="alert" className="text-sm text-red-700">{error}</p>}<Button className="w-full" disabled={busy}>{busy ? 'Salvando...' : 'Salvar nova senha'}</Button></form></AuthFrame>
}
