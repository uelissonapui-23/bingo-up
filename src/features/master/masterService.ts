import { supabase } from '@/services/supabase/client'

export type MasterWorkspaceRow = {
  workspace_id: string
  name: string
  slug: string
  owner_user_id: string
  owner_email: string | null
  is_active: boolean
  access_status: 'active' | 'suspended' | 'expired'
  event_limit: number | null
  valid_until: string | null
  notes: string | null
  events_total: number
  events_active: number
  members_total: number
  cards_sold: number
  sales_amount: number
}

export type MasterDashboard = {
  workspaces_total: number
  workspaces_active: number
  events_total: number
  users_total: number
  cards_sold: number
  sales_amount: number
}

export type PlatformBranding = {
  app_name: string
  main_logo_path: string | null
  auth_logo_path: string | null
  compact_logo_path: string | null
  public_panel_logo_path: string | null
}

export async function isPlatformOwner() {
  const { data, error } = await supabase.rpc('is_platform_owner')
  if (error) throw error
  return Boolean(data)
}

export async function getMasterDashboard(): Promise<MasterDashboard> {
  const { data, error } = await supabase.rpc('get_master_dashboard')
  if (error) throw error
  return data as MasterDashboard
}

export async function listMasterWorkspaces(): Promise<MasterWorkspaceRow[]> {
  const { data, error } = await supabase.rpc('list_master_workspaces')
  if (error) throw error
  return (data ?? []) as MasterWorkspaceRow[]
}

export async function updateWorkspaceAccess(input: {
  workspaceId: string
  accessStatus: 'active' | 'suspended' | 'expired'
  eventLimit: number | null
  validUntil: string | null
  notes: string | null
}) {
  const { error } = await supabase.rpc('master_update_workspace_access', {
    target_workspace_id: input.workspaceId,
    target_access_status: input.accessStatus,
    target_event_limit: input.eventLimit,
    target_valid_until: input.validUntil,
    target_notes: input.notes,
  })
  if (error) throw error
}

export async function getPlatformBranding(): Promise<PlatformBranding> {
  const { data, error } = await supabase.rpc('get_public_platform_branding')
  if (error) throw error
  return data as PlatformBranding
}

export async function updatePlatformBranding(branding: PlatformBranding) {
  const { error } = await supabase.rpc('master_update_platform_branding', {
    target_app_name: branding.app_name,
    target_main_logo_path: branding.main_logo_path,
    target_auth_logo_path: branding.auth_logo_path,
    target_compact_logo_path: branding.compact_logo_path,
    target_public_panel_logo_path: branding.public_panel_logo_path,
  })
  if (error) throw error
}

export async function uploadPlatformLogo(kind: 'main' | 'auth' | 'compact' | 'public-panel', file: File) {
  const ext = file.name.split('.').pop()?.toLowerCase() || 'png'
  const path = `${kind}/${kind}-${Date.now()}.${ext}`
  const { error } = await supabase.storage.from('platform-branding').upload(path, file, {
    upsert: false,
    contentType: file.type,
  })
  if (error) throw error
  return path
}
