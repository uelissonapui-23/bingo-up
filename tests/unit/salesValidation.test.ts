import { describe,expect,it } from 'vitest'
import { normalizeMoneyInput,validateBuyer } from '../../src/domain/sales/validation'

describe('sales validation',()=>{
  it('respeita campos obrigatórios do evento',()=>{expect(validateBuyer({requireName:true,requirePhone:false,requireEmail:false},{name:'',phone:'',email:''})).toContain('nome')})
  it('aceita comprador válido',()=>{expect(validateBuyer({requireName:true,requirePhone:true,requireEmail:true},{name:'Ana',phone:'11999999999',email:'ana@example.com'})).toBeNull()})
  it('normaliza moeda brasileira',()=>{expect(normalizeMoneyInput('1.234,56')).toBe(1234.56);expect(normalizeMoneyInput('-1')).toBeNull()})
})
