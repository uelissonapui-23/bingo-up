import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

describe('fallback da identidade visual global', () => {
  const source = fs.readFileSync(path.resolve('src/components/brand/PlatformBrandProvider.tsx'), 'utf8')

  it('usa a logo principal quando o icone compacto nao foi configurado', () => {
    expect(source).toContain("compactLogoUrl: publicUrl(branding.compact_logo_path ?? branding.main_logo_path")
  })

  it('usa qualquer marca configurada como fallback da TV publica', () => {
    expect(source).toContain("branding.public_panel_logo_path ?? branding.compact_logo_path ?? branding.main_logo_path")
  })
})
