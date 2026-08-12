import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '@/services/supabase/client'
import { AuthFrame } from './RegisterPage'
import {normalizeAuthReturnPath} from './authReturn'

const wait = (ms: number) => new Promise(resolve => window.setTimeout(resolve, ms))
function authErrorFromUrl() {const query = new URLSearchParams(window.location.search);const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));return query.get('error_description') ?? hash.get('error_description') ?? query.get('error') ?? hash.get('error')}

export function ConfirmEmailPage() {
  const navigate = useNavigate(); const [error, setError] = useState<string | null>(null)
  useEffect(() => {let active = true
    async function finishConfirmation() {
      const query=new URLSearchParams(window.location.search); const next=normalizeAuthReturnPath(query.get('next'))
      const urlError = authErrorFromUrl(); if (urlError) {if (active) setError('O link de confirmação é inválido ou expirou. Solicite um novo cadastro ou tente novamente.');return}
      try {
        const code = query.get('code')
        if (code) {const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);if (exchangeError) throw exchangeError}
        else {for (let attempt = 0; attempt < 12; attempt += 1) {const { data } = await supabase.auth.getSession();if (data.session) break;await wait(150)}}
        const { data } = await supabase.auth.getSession();if (!data.session) throw new Error('confirmation_session_missing')
        await supabase.auth.signOut()
        const login=new URL('/entrar',window.location.origin);login.searchParams.set('emailConfirmado','1');if(next)login.searchParams.set('next',next)
        if (active) navigate(`${login.pathname}${login.search}`, { replace: true })
      } catch {if (active) setError('Não foi possível concluir a confirmação. O link pode ter expirado. Tente abrir novamente o e-mail de confirmação.')}
    }
    void finishConfirmation();return () => { active = false }
  }, [navigate])
  return <AuthFrame title="Confirmando seu e-mail" subtitle="Aguarde enquanto validamos sua conta.">{error ? <div className="space-y-4"><p role="alert" className="rounded-2xl bg-red-950/30 p-4 text-sm font-semibold text-red-300">{error}</p><Link className="block text-center text-sm font-semibold" to="/entrar">Voltar para o login</Link></div> : <div className="rounded-2xl border border-slate-700 bg-slate-950/30 p-5 text-sm font-semibold text-slate-300">Confirmando e-mail…</div>}</AuthFrame>
}
