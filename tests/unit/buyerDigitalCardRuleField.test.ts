import fs from 'node:fs'
import {describe,expect,it} from 'vitest'

const migration=fs.readFileSync('supabase/migrations/20260813180000_fix_buyer_digital_card_rule_field.sql','utf8')

describe('buyer digital card rule field',()=>{
  it('usa o nome real da coluna free_center no banco',()=>{
    expect(migration).toContain("'has_free_center',r.free_center")
    expect(migration).not.toContain('r.has_free_center')
  })
})
