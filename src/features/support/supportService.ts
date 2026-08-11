import { supabase } from '@/services/supabase/client'

export type PlatformAccessState = {
  allowed: boolean
  status: 'active' | 'suspended'
  is_master: boolean
  blocked_title: string
  blocked_message: string
  whatsapp_number: string | null
  support_enabled: boolean
}

export type SupportMessage = {
  id: string
  sender_kind: 'user' | 'master'
  body: string | null
  attachment_path: string | null
  attachment_name: string | null
  created_at: string
}

export type SupportConversation = {
  thread_id: string | null
  status: 'open' | 'closed' | null
  messages: SupportMessage[]
}

export type MasterSupportThread = {
  thread_id: string
  user_id: string
  email: string | null
  display_name: string | null
  status: 'open' | 'closed'
  subject: string
  last_message_at: string
  unread_count: number
}

export type SupportSettings = {
  blocked_title: string
  blocked_message: string
  whatsapp_number: string | null
  support_enabled: boolean
}

export async function getMyPlatformAccess(): Promise<PlatformAccessState> {
  const { data, error } = await supabase.rpc('get_my_platform_access')
  if (error) throw error
  return data as PlatformAccessState
}

export async function getOrCreateSupportThread(): Promise<string> {
  const { data, error } = await supabase.rpc('support_get_or_create_thread')
  if (error) throw error
  return String(data)
}

export async function getMySupportConversation(): Promise<SupportConversation> {
  const { data, error } = await supabase.rpc('support_get_my_conversation')
  if (error) throw error
  return data as SupportConversation
}

export async function sendMySupportMessage(input: { body?: string; attachmentPath?: string | null; attachmentName?: string | null }) {
  const { error } = await supabase.rpc('support_send_my_message', {
    target_body: input.body?.trim() || null,
    target_attachment_path: input.attachmentPath ?? null,
    target_attachment_name: input.attachmentName ?? null,
  })
  if (error) throw error
}

export async function uploadSupportAttachment(userId: string, threadId: string, file: File) {
  validateSupportFile(file)
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-120)
  const path = `${userId}/${threadId}/${crypto.randomUUID()}-${safeName}`
  const { error } = await supabase.storage.from('platform-support').upload(path, file, {
    upsert: false,
    contentType: file.type,
    cacheControl: '3600',
  })
  if (error) throw error
  return path
}

export async function createSupportAttachmentUrl(path: string) {
  const { data, error } = await supabase.storage.from('platform-support').createSignedUrl(path, 300)
  if (error) throw error
  return data.signedUrl
}

export async function getMasterSupportSettings(): Promise<SupportSettings> {
  const { data, error } = await supabase.rpc('master_get_support_settings')
  if (error) throw error
  return data as SupportSettings
}

export async function updateMasterSupportSettings(settings: SupportSettings) {
  const { error } = await supabase.rpc('master_update_support_settings', {
    target_blocked_title: settings.blocked_title,
    target_blocked_message: settings.blocked_message,
    target_whatsapp_number: settings.whatsapp_number,
    target_support_enabled: settings.support_enabled,
  })
  if (error) throw error
}

export async function listMasterSupportThreads(): Promise<MasterSupportThread[]> {
  const { data, error } = await supabase.rpc('master_list_support_threads')
  if (error) throw error
  return (data ?? []) as MasterSupportThread[]
}

export async function getMasterSupportConversation(threadId: string): Promise<SupportConversation> {
  const { data, error } = await supabase.rpc('master_get_support_conversation', { target_thread_id: threadId })
  if (error) throw error
  return data as SupportConversation
}

export async function sendMasterSupportMessage(input: { threadId: string; body?: string; attachmentPath?: string | null; attachmentName?: string | null }) {
  const { error } = await supabase.rpc('master_send_support_message', {
    target_thread_id: input.threadId,
    target_body: input.body?.trim() || null,
    target_attachment_path: input.attachmentPath ?? null,
    target_attachment_name: input.attachmentName ?? null,
  })
  if (error) throw error
}

export async function setMasterSupportThreadStatus(threadId: string, status: 'open' | 'closed') {
  const { error } = await supabase.rpc('master_set_support_thread_status', { target_thread_id: threadId, target_status: status })
  if (error) throw error
}

function validateSupportFile(file: File) {
  const allowed = new Set(['image/png', 'image/jpeg', 'image/webp', 'application/pdf'])
  if (!allowed.has(file.type)) throw new Error('Envie PNG, JPG, WebP ou PDF.')
  if (file.size > 8 * 1024 * 1024) throw new Error('O arquivo deve ter no máximo 8 MB.')
}
