import { describe, expect, it } from 'vitest'
import {
  addDaysLocal,
  composeDue,
  dayDiffFromToday,
  dueDay,
  formatDue,
  isOverdueDue,
  localDateString,
  parseLocalDate,
  replaceDueDay,
} from './date'

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

  it('localDateString is local calendar YYYY-MM-DD, not toISOString UTC', () => {
    const morning = new Date(2026, 5, 1, 0, 30, 0)
    expect(localDateString(morning)).toBe('2026-06-01')
    const evening = new Date(2026, 5, 1, 23, 0, 0)
    expect(localDateString(evening)).toBe('2026-06-01')
    if (morning.getTimezoneOffset() < 0) {
      expect(localDateString(morning)).not.toBe(morning.toISOString().slice(0, 10))
    }
    if (evening.getTimezoneOffset() > 0) {
      expect(localDateString(evening)).not.toBe(evening.toISOString().slice(0, 10))
    }
  })

  it('isToday compares date strings without new Date(ds)', () => {
    const today = localDateString()
    expect(today === localDateString(new Date())).toBe(true)
    const ds = '2026-06-01'
    expect(ds === localDateString(parseLocalDate(ds))).toBe(true)
  })

  it('dueDay strips optional local time', () => {
    expect(dueDay('2026-11-01')).toBe('2026-11-01')
    expect(dueDay('2026-11-01T15:00')).toBe('2026-11-01')
    expect(dueDay(null)).toBeNull()
  })

  it('composeDue keeps date-only unless time is set', () => {
    expect(composeDue('2026-11-01', '')).toBe('2026-11-01')
    expect(composeDue('2026-11-01', '15:00')).toBe('2026-11-01T15:00')
    expect(composeDue('', '15:00')).toBeNull()
  })

  it('isOverdueDue compares calendar day prefix', () => {
    expect(isOverdueDue('2026-10-31T23:00', '2026-11-01')).toBe(true)
    expect(isOverdueDue('2026-11-01T08:00', '2026-11-01')).toBe(false)
    expect(isOverdueDue('2026-11-01', '2026-11-01')).toBe(false)
  })

  it('formatDue shows time only when present', () => {
    expect(formatDue('2026-11-01')).toBe('2026-11-01')
    expect(formatDue('2026-11-01T15:00')).toBe('2026-11-01 15:00')
  })

  it('replaceDueDay keeps existing clock', () => {
    expect(replaceDueDay('2026-11-01T15:00', '2026-11-08')).toBe('2026-11-08T15:00')
    expect(replaceDueDay('2026-11-01', '2026-11-08')).toBe('2026-11-08')
    expect(replaceDueDay(null, '2026-11-08')).toBe('2026-11-08')
  })
})
