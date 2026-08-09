import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '@/services/supabase/client'

type AuthState = {
  user: User | null
  session: Session | null
  loading: boolean
  signOut: () => Promise<void>
}
const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    let active = true
    void supabase.auth.getSession().then(({ data }) => { if (active) { setSession(data.session); setLoading(false) } })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => { if (active) { setSession(next); setLoading(false) } })
    return () => { active = false; listener.subscription.unsubscribe() }
  }, [])
  const signOut = useCallback(async () => { await supabase.auth.signOut() }, [])
  const value = useMemo(() => ({ session, user: session?.user ?? null, loading, signOut }), [session, loading, signOut])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
