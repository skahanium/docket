import { describe, expect, it } from 'vitest'
import { matterMatchesCadence } from './cadenceFilter'

describe('matterMatchesCadence', () => {
  it('counts blank matters only when playbook filter is empty', () => {
    const blank = { playbook_id: null, tag_ids: [] }
    expect(matterMatchesCadence(blank, { playbook_ids: [], tag_ids: [] })).toBe(true)
    expect(matterMatchesCadence(blank, { playbook_ids: [1], tag_ids: [] })).toBe(false)
  })

  it('requires all selected tags', () => {
    const matter = { playbook_id: 1, tag_ids: [1] }
    expect(matterMatchesCadence(matter, { playbook_ids: [1], tag_ids: [1, 2] })).toBe(false)
    expect(matterMatchesCadence(matter, { playbook_ids: [1], tag_ids: [1] })).toBe(true)
  })
})
