import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const sellers = fs.readFileSync(path.join(root, 'src/features/sellers/SellersPage.tsx'), 'utf8')
const operators = fs.readFileSync(path.join(root, 'src/features/operators/OperatorsPage.tsx'), 'utf8')

describe('links das centrais por função', () => {
  it('oferece um link copiável para a central do vendedor', () => {
    expect(sellers).toContain("`${window.location.origin}/venda`")
    expect(sellers).toContain('Copiar link da área do vendedor')
    expect(sellers).toContain('Use o link do convite na primeira entrada')
  })

  it('oferece um link copiável para a central do operador', () => {
    expect(operators).toContain("`${window.location.origin}/operador`")
    expect(operators).toContain('Copiar link da área do operador')
    expect(operators).toContain('Use o link do convite na primeira entrada')
  })
})
