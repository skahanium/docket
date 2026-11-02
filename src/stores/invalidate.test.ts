import { describe, expect, it } from 'vitest'
import { createRoot } from 'solid-js'
import { installNavigation } from './navigation'
import { installFiltersSort } from './filtersSort'
import { installCalendarUi } from './calendarUi'
import { installAppChrome } from './appChrome'
import { installResources } from './resources'
import { installInvalidate, invalidateAfterTaskMutation, taskMutationEpoch } from './invalidate'

function installStoreSlice(): void {
  installNavigation()
  installFiltersSort()
  installCalendarUi()
  installInvalidate()
  installAppChrome()
  installResources()
}

describe('invalidateAfterTaskMutation', () => {
  it('bumps taskMutationEpoch on every invalidation', () => {
    createRoot(() => {
      installStoreSlice()
      expect(taskMutationEpoch()).toBe(0)
      invalidateAfterTaskMutation({
        tasks: false,
        calendar: false,
        detail: false,
        stats: false,
      })
      expect(taskMutationEpoch()).toBe(1)
      invalidateAfterTaskMutation({
        tasks: false,
        calendar: false,
        detail: false,
        stats: false,
      })
      expect(taskMutationEpoch()).toBe(2)
    })
  })
})
