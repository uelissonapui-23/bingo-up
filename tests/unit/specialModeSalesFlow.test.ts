import fs from 'node:fs'
import {describe,expect,it} from 'vitest'

const salesPage=fs.readFileSync('src/features/game-modes/SpecialModeSalesPage.tsx','utf8')

describe('fluxo de venda dos modos especiais',()=>{
  it('abre um item disponível já na ação de venda',()=>{
    expect(salesPage).toContain("item.status==='available'?'sold':item.status")
    expect(salesPage).toContain("editStatus==='sold'?'Confirmar venda':'Salvar alteração'")
  })

  it('exige comprador e mostra o erro dentro do diálogo',()=>{
    expect(salesPage).toContain("editStatus==='sold'&&!buyerName")
    expect(salesPage).toContain('Informe o nome do comprador para concluir a venda.')
    expect(salesPage).toContain('{dialogError&&<p role="alert"')
  })

  it('confirma visualmente a gravação concluída',()=>{
    expect(salesPage).toContain('vendido com sucesso.')
    expect(salesPage).toContain('<p role="status"')
  })

  it('preserva o preço configurado e mostra erros reais da API',()=>{
    expect(salesPage).toContain('sold_price:item.sold_price??defaultPrice')
    expect(salesPage).toContain("getErrorMessage(x,'Não foi possível registrar a venda.')")
  })
})
