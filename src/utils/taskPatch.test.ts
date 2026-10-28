import { describe, expect, it } from 'vitest'
import { descriptionSavePatch } from './taskPatch'

describe('descriptionSavePatch', () => {
  it('sends description when non-empty', () => {
    expect(descriptionSavePatch('  hello ')).toEqual({ description: 'hello' })
  })

  it('sends clear_description instead of null', () => {
    expect(descriptionSavePatch('')).toEqual({ clear_description: true })
    expect(descriptionSavePatch('   ')).toEqual({ clear_description: true })
  })
})
