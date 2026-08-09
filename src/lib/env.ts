import { z } from 'zod'

const envSchema = z.object({
  VITE_SUPABASE_URL: z.string().url().optional(),
  VITE_SUPABASE_PUBLISHABLE_KEY: z.string().min(10).optional(),
  VITE_APP_ENV: z.enum(['development', 'staging', 'production', 'test']).default('development'),
  VITE_APP_NAME: z.string().min(1).default('BINGOUP')
})

export type RuntimeConfig = {
  appName: string
  environment: 'development' | 'staging' | 'production' | 'test'
  supabaseConfigured: boolean
  supabaseUrl?: string
  supabasePublishableKey?: string
}

export function getRuntimeConfig(): RuntimeConfig {
  const parsed = envSchema.safeParse(import.meta.env)
  if (!parsed.success) {
    console.error('Variáveis de ambiente inválidas.', parsed.error.flatten())
    return {
      appName: 'BINGOUP',
      environment: 'development',
      supabaseConfigured: false
    }
  }

  const { VITE_APP_NAME, VITE_APP_ENV, VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY } = parsed.data
  const supabaseConfigured = Boolean(VITE_SUPABASE_URL && VITE_SUPABASE_PUBLISHABLE_KEY)

  return {
    appName: VITE_APP_NAME,
    environment: VITE_APP_ENV,
    supabaseConfigured,
    ...(VITE_SUPABASE_URL ? { supabaseUrl: VITE_SUPABASE_URL } : {}),
    ...(VITE_SUPABASE_PUBLISHABLE_KEY ? { supabasePublishableKey: VITE_SUPABASE_PUBLISHABLE_KEY } : {})
  }
}
