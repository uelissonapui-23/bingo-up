import {describe,expect,it} from 'vitest'
import {readFileSync} from 'node:fs'

describe('impressão da cartela do comprador',()=>{
  it('usa uma área de impressão compatível com a regra global de print',()=>{const page=readFileSync('src/features/access/BuyerCardPage.tsx','utf8');expect(page).toContain('buyer-print-area print-area');expect(page).toContain('PrintGame')})
  it('não imprime a interface interativa do comprador',()=>{const css=readFileSync('src/styles/index.css','utf8');expect(css).toContain('.buyer-card-screen{display:none!important}');expect(css).toContain('.buyer-print-area{display:block!important')})
})
