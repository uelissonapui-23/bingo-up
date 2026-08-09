import { supabase } from '@/services/supabase/client'
import type { WorkspaceWithMembership } from '@/types/database'

export async function listMyWorkspaces(): Promise<WorkspaceWithMembership[]> {
  const { data: memberships, error } = await supabase
    .from('workspace_members')
    .select('id, role, status, workspace_id, workspaces(id,name,slug,owner_user_id,is_active,created_at,updated_at)')
    .eq('status', 'active')
  if (error) throw error
  return (memberships ?? []).flatMap((row: any) => {
    const workspace = Array.isArray(row.workspaces) ? row.workspaces[0] : row.workspaces
    if (!workspace) return []
    return [{ ...workspace, membership: { id: row.id, role: row.role, status: row.status } } as WorkspaceWithMembership]
  })
}

export async function getLastWorkspaceId() {
  const { data, error } = await supabase.from('user_preferences').select('last_workspace_id').maybeSingle()
  if (error) throw error
  return data?.last_workspace_id as string | null | undefined
}

export async function persistLastWorkspace(workspaceId: string) {
  const { error } = await supabase.rpc('set_last_workspace', { target_workspace_id: workspaceId })
  if (error) throw error
}

export async function createWorkspace(name: string, slug: string) {
  const { data, error } = await supabase.rpc('create_workspace', { workspace_name: name, workspace_slug: slug })
  if (error) throw error
  return data as string
}
