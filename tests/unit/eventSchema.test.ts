import { describe, expect, it } from 'vitest'
import { eventFormSchema } from '@/features/events/eventSchema'

describe('eventFormSchema', () => {
  it('aceita evento mínimo válido', () => {
    const result = eventFormSchema.safeParse({ name:'Bingo Beneficente', slug:'bingo-beneficente', description:'', location_name:'', address:'', starts_at:'', ends_at:'', sales_open_at:'', sales_close_at:'', default_card_price:10 })
    expect(result.success).toBe(true)
  })
  it('rejeita término anterior ao início', () => {
    const result = eventFormSchema.safeParse({ name:'Bingo', slug:'bingo', description:'', location_name:'', address:'', starts_at:'2026-08-08T20:00', ends_at:'2026-08-08T19:00', sales_open_at:'', sales_close_at:'', default_card_price:0 })
    expect(result.success).toBe(false)
  })
  it('rejeita slug inseguro', () => {
    const result = eventFormSchema.safeParse({ name:'Bingo', slug:'Bingo Com Espaço', description:'', location_name:'', address:'', starts_at:'', ends_at:'', sales_open_at:'', sales_close_at:'', default_card_price:0 })
    expect(result.success).toBe(false)
  })
})
