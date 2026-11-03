import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRoot } from 'solid-js'
import { setInvokeForTests, resetInvokeForTests } from '../bindings/commands'
import { installNavigation } from './navigation'
import { installFiltersSort } from './filtersSort'
import { installCalendarUi } from './calendarUi'
import { installInvalidate } from './invalidate'
import { installAppChrome } from './appChrome'
import { installResources } from './resources'
import { installToast, toasts } from './toast'
import { completeTaskFromList } from './listActions'
import * as invalidateMod from './invalidate'

function installStore(): void {
  installNavigation()
  installFiltersSort()
  installCalendarUi()
  installToast()
  installInvalidate()
  installAppChrome()
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

  it('emits an undo action that reopens the task', async () => {
    const invoke = vi.fn(async (cmd: string) => {
      if (cmd === 'complete_task' || cmd === 'reopen_task') return undefined
      throw new Error(`unexpected ${cmd}`)
    })
    setInvokeForTests(invoke as never)

    await completeTaskFromList(42)

    const list = toasts()
    expect(list).toHaveLength(1)
    expect(list[0].action?.label).toBe('撤销')
    list[0].action?.onClick()
    await new Promise((r) => setTimeout(r, 0))
    expect(invoke).toHaveBeenCalledWith('reopen_task', { id: 42 })
  })
})
