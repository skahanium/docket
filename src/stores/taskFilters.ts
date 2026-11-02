import type { Facet, ViewKind } from './navigation'

export interface TaskListFilterInput {
  activeView: ViewKind
  searchQuery: string
  activePriority: number | null
  selectedDate: string | null
}

export interface BuiltTaskListFilters {
  status?: string
  category_id?: number
  tag_id?: number
  search_query?: string
  today_view?: boolean
  overdue_view?: boolean
  due_date?: string
  priority?: number
  is_archive?: boolean
}

/** Pure mapping from UI navigation/filter state to `list_tasks` IPC filters. */
export function buildTaskListFilters(input: TaskListFilterInput): BuiltTaskListFilters {
  const { activeView, searchQuery, activePriority, selectedDate } = input

  return {
    status: 'active',
    search_query: searchQuery || undefined,
    due_date: activeView === 'calendar' ? (selectedDate ?? undefined) : undefined,
    priority: activePriority ?? undefined,
  }
}

/** Facet page task query: category or tag only, never due_date. */
export function buildFacetTaskFilters(facet: Facet): BuiltTaskListFilters {
  if (facet.type === 'category') {
    return { status: 'active', category_id: facet.id }
  }
  return { status: 'active', tag_id: facet.id }
}
