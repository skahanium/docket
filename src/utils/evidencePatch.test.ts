import { describe, expect, it } from 'vitest'
import { evidenceLinkInput } from './evidencePatch'

describe('evidenceLinkInput', () => {
  it('rejects empty and whitespace paths', () => {
    expect(evidenceLinkInput('', 'file')).toBeNull()
    expect(evidenceLinkInput('   ', 'folder')).toBeNull()
  })

  it('keeps trimmed absolute-looking path', () => {
    expect(evidenceLinkInput(' /tmp/case ', 'folder')).toEqual({
      path: '/tmp/case',
      kind: 'folder',
    })
  })
})
