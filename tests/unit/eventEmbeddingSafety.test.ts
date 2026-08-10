import { describe, expect, it } from 'vitest'
import fs from 'node:fs'

describe('relacionamento events/event_settings', () => {
  it('usa explicitamente a FK canônica no embed do PostgREST', () => {
    const source = fs.readFileSync('src/features/events/eventService.ts', 'utf8')
    expect(source).toContain('event_settings!event_settings_event_id_fkey(*)')
  })

  it('a correção remove as FKs compostas ambíguas e mantém validação por trigger', () => {
    const sql = fs.readFileSync('supabase/migrations/20260810155000_fix_event_embedding_and_expand_layouts.sql', 'utf8')
    expect(sql).toContain("drop constraint if exists")
    expect(sql).toContain('enforce_event_workspace_match')
  })
})
