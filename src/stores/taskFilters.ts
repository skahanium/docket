import type { ViewKind } from './navigation'

export interface TaskListFilterInput {
  activeView: ViewKind
  activeCategoryId: number | null
  activeTagId: number | null
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
  due_date?: string
  priority?: number
  is_archive?: boolean
}

/** Pure mapping from UI navigation/filter state to `list_tasks` IPC filters. */
export function buildTaskListFilters(input: TaskListFilterInput): BuiltTaskListFilters {
  const {
    activeView,
    activeCategoryId,
    activeTagId,
    searchQuery,
    activePriority,
    selectedDate,
  } = input

  return {
    status:
      activeView === 'archive'
        ? undefined
        : activeView === 'all' || activeView === 'today'
          ? 'active'
          : undefined,
    category_id: activeCategoryId ?? undefined,
    tag_id: activeTagId ?? undefined,
    search_query: searchQuery || undefined,
    today_view: activeView === 'today' ? true : undefined,
    due_date: selectedDate ?? undefined,
    priority: activePriority ?? undefined,
    is_archive: activeView === 'archive' ? true : undefined,
  }
}
