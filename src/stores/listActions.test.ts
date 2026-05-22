import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRoot } from 'solid-js'
import { setInvokeForTests, resetInvokeForTests } from '../bindings/commands'
import { installNavigation } from './navigation'
import { installFiltersSort } from './filtersSort'
import { installCalendarUi } from './calendarUi'
import { installInvalidate } from './invalidate'
import { installResources } from './resources'
import { installToast } from './toast'
import { completeTaskFromList } from './listActions'
import * as invalidateMod from './invalidate'

function installStore(): void {
  installNavigation()
  installFiltersSort()
  installCalendarUi()
  installToast()
  installInvalidate()
  installResources()
}

describe('completeTaskFromList', () => {
  beforeEach(() => {
    createRoot(installStore)
  })

  afterEach(() => {
    resetInvokeForTests()
    vi.restoreAllMocks()
  })

  it('calls complete_task and invalidates caches', async () => {
    const invoke = vi.fn(async (cmd: string) => {
      if (cmd === 'complete_task') return undefined
      throw new Error(`unexpected ${cmd}`)
    })
    setInvokeForTests(invoke as never)

    const invalidateSpy = vi.spyOn(invalidateMod, 'invalidateAfterTaskMutation')

    await completeTaskFromList(42)

    expect(invoke).toHaveBeenCalledWith('complete_task', { id: 42 })
    expect(invalidateSpy).toHaveBeenCalledOnce()
  })
})
