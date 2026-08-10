import {describe,expect,it} from 'vitest'
import {countChecks,type EventOperationalHealth} from '../../src/domain/operations/health'

describe('monitoramento operacional',()=>{
  it('resume checks por severidade sem alterar o estado recebido',()=>{
    const health={checks:[{code:'a',level:'ok',label:'A',detail:''},{code:'b',level:'warning',label:'B',detail:''},{code:'c',level:'critical',label:'C',detail:''}]} as EventOperationalHealth
    expect(countChecks(health)).toEqual({ok:1,warning:1,critical:1})
  })
})
