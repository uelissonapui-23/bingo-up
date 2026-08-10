import { supabase } from '@/services/supabase/client'
import type { BingoRuleSet, CardBatch, CardTemplate, GameDefinition, GenerationUniquenessMode } from '@/types/database'
import type { GeneratedPhysicalCard } from '@/domain/cards/generator'
import type { CardArtworkOptions, CardGameStyleOptions } from '@/domain/cards/templateOptions'

export async function countGameDefinitions(ruleSetId: string): Promise<number> {
  const { count, error } = await supabase.from('game_definitions').select('id', { count: 'exact', head: true }).eq('rule_set_id', ruleSetId)
  if (error) throw error
  return count ?? 0
}

export async function loadExistingGameDefinitions(ruleSetId: string): Promise<GameDefinition[]> {
  const rows: GameDefinition[] = []
  const pageSize = 1000
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase.from('game_definitions').select('*').eq('rule_set_id', ruleSetId).order('created_at').range(from, from + pageSize - 1)
    if (error) throw error
    const page = (data ?? []) as GameDefinition[]
    rows.push(...page)
    if (page.length < pageSize) break
  }
  return rows
}

export async function loadExistingCompositionSignatures(ruleSetId: string): Promise<Set<string>> {
  const result = new Set<string>()
  const pageSize = 1000
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase.from('physical_cards').select('composition_signature').eq('rule_set_id', ruleSetId).neq('status', 'void').range(from, from + pageSize - 1)
    if (error) throw error
    const page = data ?? []
    page.forEach((row: { composition_signature: string }) => result.add(row.composition_signature))
    if (page.length < pageSize) break
  }
  return result
}

export async function listCardBatches(workspaceId: string, eventId: string): Promise<CardBatch[]> {
  const { data, error } = await supabase.from('card_batches').select('*').eq('workspace_id', workspaceId).eq('event_id', eventId).order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as CardBatch[]
}

export async function createCardBatch(input: {
  workspaceId: string
  eventId: string
  rule: BingoRuleSet
  template: CardTemplate
  artwork?: CardArtworkOptions
  gameStyle?: CardGameStyleOptions
  seriesCode: string
  requestedCards: number
  startNumber: number
  codePadding: number
  uniquenessMode: GenerationUniquenessMode
  capacitySnapshot: Record<string, unknown>
}): Promise<string> {
  const { data, error } = await supabase.rpc('create_card_batch', {
    target_workspace_id: input.workspaceId,
    target_event_id: input.eventId,
    target_rule_set_id: input.rule.id,
    target_template_id: input.template.id,
    batch_series_code: input.seriesCode,
    batch_requested_cards: input.requestedCards,
    batch_start_number: input.startNumber,
    batch_code_padding: input.codePadding,
    batch_uniqueness_mode: input.uniquenessMode,
    batch_capacity_snapshot: input.capacitySnapshot,
    batch_generation_options: {
      generator_version: 1,
      artwork_snapshot: input.artwork ?? null,
      game_style_snapshot: input.gameStyle ?? null,
      template_snapshot: {
        id: input.template.id,
        name: input.template.name,
        physical_format: input.template.physical_format,
        layout_key: input.template.layout_key,
        orientation: input.template.orientation,
        page_size: input.template.page_size,
        options: input.template.options,
      },
    },
  })
  if (error) throw error
  return data as string
}

export async function persistGeneratedCards(batchId: string, cards: GeneratedPhysicalCard[], chunkSize = 100, onProgress?: (persisted: number) => void) {
  let persisted = 0
  for (let i = 0; i < cards.length; i += chunkSize) {
    const chunk = cards.slice(i, i + chunkSize)
    const { error } = await supabase.rpc('persist_generated_cards', { target_batch_id: batchId, cards_payload: chunk })
    if (error) throw error
    persisted += chunk.length
    onProgress?.(persisted)
  }
}

export async function finalizeCardBatch(batchId: string) {
  const { error } = await supabase.rpc('finalize_card_batch', { target_batch_id: batchId })
  if (error) throw error
}

export async function markCardBatchFailed(batchId: string, message: string) {
  const { error } = await supabase.rpc('mark_card_batch_failed', { target_batch_id: batchId, failure_message: message })
  if (error) throw error
}

export async function cancelCardBatch(batchId: string, reason?: string) {
  const { error } = await supabase.rpc('cancel_card_batch', { target_batch_id: batchId, reason: reason ?? null })
  if (error) throw error
}

export async function deleteUnusedCardBatch(batchId: string) {
  const { data, error } = await supabase.rpc('delete_unused_card_batch', { target_batch_id: batchId })
  if (error) throw error
  return data as { deleted_cards: number; deleted_orphan_games: number }
}
