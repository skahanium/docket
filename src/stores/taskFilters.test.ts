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

  it('maps today view', () => {
    const f = buildTaskListFilters({ ...base, activeView: 'today' })
    expect(f.status).toBe('active')
    expect(f.today_view).toBe(true)
    expect(f.is_archive).toBeUndefined()
  })

  it('maps archive view', () => {
    const f = buildTaskListFilters({ ...base, activeView: 'archive' })
    expect(f.status).toBeUndefined()
    expect(f.is_archive).toBe(true)
    expect(f.today_view).toBeUndefined()
  })

  it('passes category, tag, search, date, priority', () => {
    const f = buildTaskListFilters({
      ...base,
      activeView: 'all',
      activeCategoryId: 3,
      activeTagId: 7,
      searchQuery: '  hello ',
      activePriority: 2,
      selectedDate: '2026-06-01',
    })
    expect(f.category_id).toBe(3)
    expect(f.tag_id).toBe(7)
    expect(f.search_query).toBe('  hello ')
    expect(f.priority).toBe(2)
    expect(f.due_date).toBe('2026-06-01')
  })
})
