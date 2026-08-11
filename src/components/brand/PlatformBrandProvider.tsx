import { createContext, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react'
import { supabase } from '@/services/supabase/client'
import { getPlatformBranding, type PlatformBranding } from '@/features/master/masterService'

const defaults: PlatformBranding = {
  app_name: 'BINGOUP',
  main_logo_path: null,
  auth_logo_path: null,
  compact_logo_path: null,
  public_panel_logo_path: null,
}

type BrandContextValue = PlatformBranding & {
  mainLogoUrl: string
  authLogoUrl: string
  compactLogoUrl: string
  publicPanelLogoUrl: string
  refreshBranding: () => Promise<void>
}

const BrandContext = createContext<BrandContextValue | null>(null)

function publicUrl(path: string | null, fallback: string) {
  if (!path) return fallback
  return supabase.storage.from('platform-branding').getPublicUrl(path).data.publicUrl
}

export function PlatformBrandProvider({ children }: PropsWithChildren) {
  const [branding, setBranding] = useState<PlatformBranding>(defaults)
  async function refreshBranding() {
    try { setBranding(await getPlatformBranding()) } catch { /* branding nunca pode derrubar o app */ }
  }
  useEffect(() => { void refreshBranding() }, [])
  const value = useMemo<BrandContextValue>(() => ({
    ...branding,
    mainLogoUrl: publicUrl(branding.main_logo_path, '/brand/bingoup-logo-dark.png'),
    authLogoUrl: publicUrl(branding.auth_logo_path ?? branding.main_logo_path, '/brand/bingoup-logo-dark.png'),
    compactLogoUrl: publicUrl(branding.compact_logo_path, '/brand/bingoup-icon.png'),
    publicPanelLogoUrl: publicUrl(branding.public_panel_logo_path ?? branding.compact_logo_path, '/brand/bingoup-icon.png'),
    refreshBranding,
  }), [branding])
  return <BrandContext.Provider value={value}>{children}</BrandContext.Provider>
}

export function usePlatformBrand() {
  const value = useContext(BrandContext)
  if (!value) throw new Error('usePlatformBrand must be used inside PlatformBrandProvider')
  return value
}
