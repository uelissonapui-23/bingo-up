import { describe, expect, it } from 'vitest'
import fs from 'node:fs'

describe('persistência da arte ao navegar pelos modelos',()=>{
  const generator=fs.readFileSync('src/features/card-generator/CardGeneratorPage.tsx','utf8')
  const migration=fs.readFileSync('supabase/migrations/20260812210000_fix_support_storage_policy_and_card_artwork_flow.sql','utf8')

  it('não limpa a imagem local só porque o modelo mudou',()=>{
    expect(generator).toContain('preserve o arquivo local')
    expect(generator).toContain('},[eventArtwork])')
    expect(generator).not.toContain('},[eventArtwork,template])')
  })

  it('mantém a arte compartilhada do evento na geração e na personalização',()=>{
    expect(generator).toContain('artwork:eventArtwork??parseCardTemplateOptions(template.options).artwork')
    expect(generator).toContain('artwork:eventArtwork??parseCardTemplateOptions(template.options).artwork,gameStyle:style')
  })

  it('impede a policy do suporte de bloquear uploads de outros buckets',()=>{
    expect(migration).toContain('can_access_platform_support_thread')
    expect(migration).toContain("bucket_id='platform-support'")
    expect(migration).not.toContain('exists(select 1 from public.platform_support_threads')
  })
})
