import { supabase } from '@/services/supabase/client'
import type { BingoEvent, EventSettings, EventWithSettings } from '@/types/database'
import type { EventFormValues } from './eventSchema'

function isoOrNull(value?: string) {
  return value ? new Date(value).toISOString() : null
}

export async function listEvents(workspaceId: string, includeArchived = false): Promise<EventWithSettings[]> {
  let query = supabase
    .from('events')
    .select('*, event_settings!event_settings_event_id_fkey(*)')
    .eq('workspace_id', workspaceId)
    .order('starts_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })

  if (!includeArchived) query = query.neq('status', 'archived')
  const { data, error } = await query
  if (error) throw error
  return (data ?? []).map((row: any) => ({
    ...row,
    settings: Array.isArray(row.event_settings) ? row.event_settings[0] : row.event_settings,
  })) as EventWithSettings[]
}

export async function getEvent(workspaceId: string, eventId: string): Promise<EventWithSettings> {
  const { data, error } = await supabase
    .from('events')
    .select('*, event_settings!event_settings_event_id_fkey(*)')
    .eq('workspace_id', workspaceId)
    .eq('id', eventId)
    .single()
  if (error) throw error
  const row: any = data
  return { ...row, settings: Array.isArray(row.event_settings) ? row.event_settings[0] : row.event_settings } as EventWithSettings
}

export async function createEvent(workspaceId: string, values: EventFormValues) {
  const { data, error } = await supabase.rpc('create_event_with_settings', {
    target_workspace_id: workspaceId,
    event_name: values.name,
    event_slug: values.slug,
    event_description: values.description || null,
    event_location_name: values.location_name || null,
    event_address: values.address || null,
    event_starts_at: isoOrNull(values.starts_at),
    event_ends_at: isoOrNull(values.ends_at),
    event_sales_open_at: isoOrNull(values.sales_open_at),
    event_sales_close_at: isoOrNull(values.sales_close_at),
    event_default_card_price: values.default_card_price,
  })
  if (error) throw error
  return data as string
}

export async function updateEvent(workspaceId: string, eventId: string, values: EventFormValues) {
  const { error } = await supabase.from('events').update({
    name: values.name.trim(), slug: values.slug.trim(), description: values.description || null,
    location_name: values.location_name || null, address: values.address || null,
    starts_at: isoOrNull(values.starts_at), ends_at: isoOrNull(values.ends_at),
    sales_open_at: isoOrNull(values.sales_open_at), sales_close_at: isoOrNull(values.sales_close_at),
  }).eq('workspace_id', workspaceId).eq('id', eventId)
  if (error) throw error
  const { error: settingsError } = await supabase.from('event_settings').update({ default_card_price: values.default_card_price }).eq('workspace_id', workspaceId).eq('event_id', eventId)
  if (settingsError) throw settingsError
  await supabase.rpc('log_audit', { target_workspace_id: workspaceId, target_action: 'event.updated', target_entity_type: 'event', target_entity_id: eventId, target_metadata: {} })
}

export async function updateEventStatus(workspaceId: string, eventId: string, status: BingoEvent['status']) {
  const patch: Partial<BingoEvent> = { status }
  if (status !== 'archived') patch.archived_at = null
  const { error } = await supabase.from('events').update(patch).eq('workspace_id', workspaceId).eq('id', eventId)
  if (error) throw error
  await supabase.rpc('log_audit', { target_workspace_id: workspaceId, target_action: 'event.status_changed', target_entity_type: 'event', target_entity_id: eventId, target_metadata: { status } })
}


export async function finalizeEvent(eventId: string) {
  const { error } = await supabase.rpc('finalize_event', { target_event_id: eventId })
  if (error) throw error
}

async function listStorageFiles(bucket: string, prefix: string): Promise<string[]> {
  const result: string[] = []
  const visit = async (path: string) => {
    let offset = 0
    while (true) {
      const { data, error } = await supabase.storage.from(bucket).list(path, { limit: 100, offset, sortBy: { column: 'name', order: 'asc' } })
      if (error) throw error
      const entries = data ?? []
      for (const entry of entries) {
        const child = path ? `${path}/${entry.name}` : entry.name
        if (entry.id) result.push(child)
        else await visit(child)
      }
      if (entries.length < 100) break
      offset += entries.length
    }
  }
  await visit(prefix)
  return result
}

async function removeEventStorage(workspaceId: string, eventId: string) {
  const prefix = `${workspaceId}/${eventId}`
  for (const bucket of ['event-assets', 'card-artworks']) {
    const paths = await listStorageFiles(bucket, prefix)
    if (paths.length) {
      const { error } = await supabase.storage.from(bucket).remove(paths)
      if (error) throw error
    }
  }
}

export async function deleteFinishedEvent(workspaceId: string, eventId: string) {
  const { error } = await supabase.rpc('delete_finished_event', { target_event_id: eventId })
  if (error) throw error
  try {
    await removeEventStorage(workspaceId, eventId)
    return { storageCleaned: true }
  } catch (cleanupError) {
    console.warn('Evento excluído, mas alguns arquivos do Storage não puderam ser removidos.', cleanupError)
    return { storageCleaned: false }
  }
}

export async function archiveEvent(eventId: string) {
  const { error } = await supabase.rpc('archive_event', { target_event_id: eventId })
  if (error) throw error
}

export async function restoreEvent(eventId: string) {
  const { error } = await supabase.rpc('restore_event', { target_event_id: eventId })
  if (error) throw error
}

export async function updateEventSettings(workspaceId: string, eventId: string, patch: Partial<EventSettings>) {
  const allowed = {
    require_buyer_name: patch.require_buyer_name,
    require_buyer_phone: patch.require_buyer_phone,
    require_buyer_email: patch.require_buyer_email,
    allow_reservations: patch.allow_reservations,
    reservation_minutes: patch.reservation_minutes,
    sales_mode: patch.sales_mode,
    public_panel_show_last_number: patch.public_panel_show_last_number,
    public_panel_show_called_numbers: patch.public_panel_show_called_numbers,
    public_panel_show_progress: patch.public_panel_show_progress,
    public_panel_show_near_winners: patch.public_panel_show_near_winners,
    near_winner_thresholds: patch.near_winner_thresholds,
  }
  const clean = Object.fromEntries(Object.entries(allowed).filter(([, value]) => value !== undefined))
  const { error } = await supabase.from('event_settings').update(clean).eq('workspace_id', workspaceId).eq('event_id', eventId)
  if (error) throw error
}

export async function uploadEventBanner(workspaceId: string, eventId: string, file: File) {
  const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg'
  const path = `${workspaceId}/${eventId}/banner-${Date.now()}.${extension}`
  const { error: uploadError } = await supabase.storage.from('event-assets').upload(path, file, { upsert: true, contentType: file.type })
  if (uploadError) throw uploadError
  const { error } = await supabase.from('events').update({ banner_path: path }).eq('workspace_id', workspaceId).eq('id', eventId)
  if (error) throw error
  return path
}

export async function getEventBannerUrl(path: string) {
  const { data, error } = await supabase.storage.from('event-assets').createSignedUrl(path, 3600)
  if (error) throw error
  return data.signedUrl
}
