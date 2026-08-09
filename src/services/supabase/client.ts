import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { getRuntimeConfig } from '@/lib/env'

let client: SupabaseClient | null = null

export function getSupabaseClient(): SupabaseClient | null {
  if (client) return client

  const config = getRuntimeConfig()
  if (!config.supabaseConfigured || !config.supabaseUrl || !config.supabasePublishableKey) {
    return null
  }

  client = createClient(config.supabaseUrl, config.supabasePublishableKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  })

  return client
}

// Proxy lazy: mantém os módulos simples sem criar o cliente antes das variáveis de ambiente existirem.
// Qualquer operação de dados sem configuração falha com uma mensagem explícita, em vez de quebrar silenciosamente no import.
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, property) {
    const activeClient = getSupabaseClient()
    if (!activeClient) throw new Error('Supabase não configurado. Preencha VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY.')
    const value = Reflect.get(activeClient, property, activeClient)
    return typeof value === 'function' ? value.bind(activeClient) : value
  },
})
