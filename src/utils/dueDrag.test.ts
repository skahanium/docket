import { describe, expect, it } from 'vitest'
import { encodeDueDrag, parseDueDrag } from './dueDrag'

describe('due drag payload', () => {
  it('roundtrips task and matter step', () => {
    expect(parseDueDrag(encodeDueDrag({ kind: 'task', id: 3, due: '2026-11-01T15:00' }))).toEqual({
      kind: 'task',
      id: 3,
      due: '2026-11-01T15:00',
    })
    expect(parseDueDrag(encodeDueDrag({ kind: 'matter_step', id: 9 }))).toEqual({
      kind: 'matter_step',
      id: 9,
    })
  })

  it('accepts legacy plain task id', () => {
    expect(parseDueDrag('12')).toEqual({ kind: 'task', id: 12 })
  })

  it('rejects junk', () => {
    expect(parseDueDrag('')).toBeNull()
    expect(parseDueDrag('{"kind":"event","id":1}')).toBeNull()
  })
})
