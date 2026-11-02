import { describe, expect, it } from 'vitest'
import { buildTaskListFilters } from './taskFilters'

describe('buildTaskListFilters', () => {
  const base = {
    activeCategoryId: null,
    activeTagId: null,
    searchQuery: '',
    activePriority: null,
    selectedDate: null,
  }

  it('maps tasks view to the active task library', () => {
    const f = buildTaskListFilters({ ...base, activeView: 'tasks' })
    expect(f.status).toBe('active')
    expect(f.is_archive).toBeUndefined()
    expect(f.today_view).toBeUndefined()
    expect(f.overdue_view).toBeUndefined()
  })

  it('does not treat today as a task-list today_view', () => {
    const f = buildTaskListFilters({ ...base, activeView: 'today' })
    expect(f.today_view).toBeUndefined()
    expect(f.overdue_view).toBeUndefined()
  })

  it('passes due_date from selectedDate for the calendar day list', () => {
    const f = buildTaskListFilters({
      ...base,
      activeView: 'calendar',
      selectedDate: '2026-11-02',
    })
    expect(f.due_date).toBe('2026-11-02')
    expect(f.status).toBe('active')
  })

  it('does not leak a leftover selectedDate into the task library', () => {
    const f = buildTaskListFilters({
      ...base,
      activeView: 'tasks',
      selectedDate: '2026-11-02',
    })
    expect(f.due_date).toBeUndefined()
  })

  it('passes category, tag, search, and priority', () => {
    const f = buildTaskListFilters({
      ...base,
      activeView: 'tasks',
      activeCategoryId: 3,
      activeTagId: 7,
      searchQuery: '  hello ',
      activePriority: 2,
    })
    expect(f.category_id).toBe(3)
    expect(f.tag_id).toBe(7)
    expect(f.search_query).toBe('  hello ')
    expect(f.priority).toBe(2)
  })
})
