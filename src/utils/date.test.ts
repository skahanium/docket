import { describe, expect, it } from 'vitest'
import { addDaysLocal, dayDiffFromToday, localDateString, parseLocalDate } from './date'

describe('date utils', () => {
  it('addDaysLocal does not use UTC midnight', () => {
    expect(addDaysLocal('2026-05-22', -1)).toBe('2026-05-21')
    expect(addDaysLocal('2026-05-22', 1)).toBe('2026-05-23')
  })

  it('dayDiffFromToday uses local calendar days', () => {
    const today = localDateString()
    expect(dayDiffFromToday(today)).toBe(0)
    expect(dayDiffFromToday(addDaysLocal(today, -1))).toBe(-1)
    expect(dayDiffFromToday(addDaysLocal(today, 1))).toBe(1)
  })

  it('parseLocalDate uses local components', () => {
    const d = parseLocalDate('2026-05-22')
    expect(d.getFullYear()).toBe(2026)
    expect(d.getMonth()).toBe(4)
    expect(d.getDate()).toBe(22)
  })
})
