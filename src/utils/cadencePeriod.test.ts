import { describe, expect, it } from 'vitest'
import { inclusiveEndDate } from './cadencePeriod'

describe('inclusiveEndDate', () => {
  it('returns the last included day of a half-open period', () => {
    expect(inclusiveEndDate('2026-11-01')).toBe('2026-10-31')
    expect(inclusiveEndDate('2026-01-01')).toBe('2025-12-31')
  })
})
