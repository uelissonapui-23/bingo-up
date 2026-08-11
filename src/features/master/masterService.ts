import { supabase } from '@/services/supabase/client'

export type AccessStatus = 'active' | 'suspended' | 'expired'
export type UserAccessStatus = 'active' | 'suspended' | 'master'
export type MembershipStatus = 'invited' | 'active' | 'suspended' | 'revoked'
export type WorkspaceRole = 'organizer_owner' | 'organizer_admin' | 'event_manager' | 'seller' | 'draw_operator'

export type MasterWorkspaceRow = {
  workspace_id: string; name: string; slug: string; owner_user_id: string; owner_email: string | null; is_active: boolean
  access_status: AccessStatus; plan_code: string | null; event_limit: number | null; valid_until: string | null; notes: string | null
  events_total: number; events_active: number; members_total: number; cards_sold: number; sales_amount: number
}
export type MasterDashboard = { workspaces_total: number; workspaces_active: number; events_total: number; users_total: number; cards_sold: number; sales_amount: number }
export type PlatformBranding = { app_name: string; main_logo_path: string | null; auth_logo_path: string | null; compact_logo_path: string | null; public_panel_logo_path: string | null }
export type CommercialPlan = { code: string; name: string; description: string | null; event_limit: number | null; price_cents: number | null; billing_label: string | null; is_active: boolean; sort_order: number }
export type MasterMembership = { workspace_id: string; workspace_name: string; role: WorkspaceRole; status: MembershipStatus }
export type MasterUserRow = { user_id: string; email: string | null; display_name: string | null; platform_access_status: UserAccessStatus; block_reason: string | null; last_sign_in_at: string | null; created_at: string; memberships: MasterMembership[] }
export type MasterAuditRow = { id: number; actor_email: string | null; action: string; target_workspace_id: string | null; workspace_name: string | null; metadata: Record<string, unknown>; created_at: string }

export type HomologationCheck = { id: string; level: 'ok' | 'info' | 'warning' | 'critical'; title: string; detail: string }

export type HomologationPendingWinner = { id:string; event_id:string; event_name:string; session_id:string; session_number:number; session_name:string; card_code:string|null; game_position:number|null; detected_at:string }
export type HomologationOpenDraw = { session_id:string; event_id:string; event_name:string; session_number:number; session_name:string; status:'active'|'paused'; called_count:number; participant_games:number; started_at:string }
export type HomologationPendingAccess = { user_id:string; email:string|null; display_name:string|null; reason:string|null; created_at:string }
export type HomologationSupportThread = { thread_id:string; user_id:string; email:string|null; display_name:string|null; subject:string; last_message_at:string }
export type HomologationDetails = { pending_winners:HomologationPendingWinner[]; open_draw_sessions:HomologationOpenDraw[]; pending_access_users:HomologationPendingAccess[]; open_support_threads:HomologationSupportThread[] }

export type HomologationStatus = {
  status: 'ready' | 'attention' | 'critical'
  checked_at: string
  metrics: { masters: number; workspaces: number; events: number; sold_cards: number; pending_access_users: number; blocked_users: number; open_support_threads: number; pending_winner_candidates: number; open_draw_sessions: number; workspaces_without_license: number }
  checks: HomologationCheck[]
}

export async function isPlatformOwner() { const { data, error } = await supabase.rpc('is_platform_owner'); if (error) throw error; return Boolean(data) }
export async function getMasterDashboard(): Promise<MasterDashboard> { const { data, error } = await supabase.rpc('get_master_dashboard'); if (error) throw error; return data as MasterDashboard }
export async function listMasterWorkspaces(): Promise<MasterWorkspaceRow[]> { const { data, error } = await supabase.rpc('list_master_workspaces'); if (error) throw error; return (data ?? []) as MasterWorkspaceRow[] }
export async function listMasterPlans(): Promise<CommercialPlan[]> { const { data, error } = await supabase.rpc('list_master_plans'); if (error) throw error; return (data ?? []) as CommercialPlan[] }
export async function listMasterUsers(): Promise<MasterUserRow[]> { const { data, error } = await supabase.rpc('list_master_users'); if (error) throw error; return (data ?? []) as MasterUserRow[] }
export async function listMasterAudit(limit = 80): Promise<MasterAuditRow[]> { const { data, error } = await supabase.rpc('list_master_audit', { limit_rows: limit }); if (error) throw error; return (data ?? []) as MasterAuditRow[] }
export async function getMasterHomologationStatus(): Promise<HomologationStatus> { const { data, error } = await supabase.rpc('master_get_homologation_status'); if (error) throw error; return data as HomologationStatus }
export async function getMasterHomologationDetails(): Promise<HomologationDetails> { const { data, error } = await supabase.rpc('master_get_homologation_details'); if (error) throw error; return data as HomologationDetails }

export async function updateWorkspaceAccess(input: { workspaceId: string; accessStatus: AccessStatus; planCode: string | null; eventLimit: number | null; validUntil: string | null; notes: string | null }) {
  const { error } = await supabase.rpc('master_update_workspace_access_v2', { target_workspace_id: input.workspaceId, target_access_status: input.accessStatus, target_plan_code: input.planCode, target_event_limit: input.eventLimit, target_valid_until: input.validUntil, target_notes: input.notes }); if (error) throw error
}
export async function saveCommercialPlan(plan: CommercialPlan) { const { error } = await supabase.rpc('master_upsert_plan', { target_code: plan.code, target_name: plan.name, target_description: plan.description, target_event_limit: plan.event_limit, target_price_cents: plan.price_cents, target_billing_label: plan.billing_label, target_is_active: plan.is_active, target_sort_order: plan.sort_order }); if (error) throw error }
export async function updateUserAccess(userId: string, status: 'active' | 'suspended', reason: string | null) { const { error } = await supabase.rpc('master_update_user_access', { target_user_id: userId, target_access_status: status, target_reason: reason }); if (error) throw error }
export async function updateMembership(input: { workspaceId: string; userId: string; role: WorkspaceRole; status: MembershipStatus }) { const { error } = await supabase.rpc('master_update_membership', { target_workspace_id: input.workspaceId, target_user_id: input.userId, target_role: input.role, target_status: input.status }); if (error) throw error }

export async function getPlatformBranding(): Promise<PlatformBranding> { const { data, error } = await supabase.rpc('get_public_platform_branding'); if (error) throw error; return data as PlatformBranding }
export async function updatePlatformBranding(branding: PlatformBranding) { const { error } = await supabase.rpc('master_update_platform_branding', { target_app_name: branding.app_name, target_main_logo_path: branding.main_logo_path, target_auth_logo_path: branding.auth_logo_path, target_compact_logo_path: branding.compact_logo_path, target_public_panel_logo_path: branding.public_panel_logo_path }); if (error) throw error }
export async function uploadPlatformLogo(kind: 'main' | 'auth' | 'compact' | 'public-panel', file: File) {
  const extensions: Record<string,string> = { 'image/png':'png', 'image/jpeg':'jpg', 'image/webp':'webp' }
  const ext=extensions[file.type]
  if(!ext)throw new Error('Formato de logo não permitido. Use PNG, JPG ou WebP.')
  if(file.size>5*1024*1024)throw new Error('A logo deve ter no máximo 5 MB.')
  const path = `${kind}/${kind}-${Date.now()}-${crypto.randomUUID()}.${ext}`
  const { error } = await supabase.storage.from('platform-branding').upload(path, file, { upsert: false, contentType: file.type, cacheControl:'3600' }); if (error) throw error; return path
}
