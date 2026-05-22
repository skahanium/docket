import { createResource, createMemo, createEffect } from 'solid-js'
import * as api from '../bindings/commands'
import { activeView, selectedTaskId } from './navigation'
import {
  activeCategoryId,
  activeTagId,
  searchQuery,
  activePriority,
  sortField,
  sortDir,
} from './filtersSort'
import { selectedDate, calendarYear, calendarMonth } from './calendarUi'
import { buildTaskListFilters } from './taskFilters'

export let tasks: ReturnType<typeof createResource<api.TaskSummary[]>>[0]
export let refetchTasks: ReturnType<typeof createResource<api.TaskSummary[]>>[1]['refetch']
export let categories: ReturnType<typeof createResource<api.Category[]>>[0]
export let refetchCategories: ReturnType<typeof createResource<api.Category[]>>[1]['refetch']
export let tags: ReturnType<typeof createResource<api.Tag[]>>[0]
export let refetchTags: ReturnType<typeof createResource<api.Tag[]>>[1]['refetch']
export let taskDetail: ReturnType<typeof createResource<api.TaskWithDetails | null>>[0]
export let refetchDetail: ReturnType<typeof createResource<api.TaskWithDetails | null>>[1]['refetch']
export let calendarData: ReturnType<typeof createResource<api.CalendarDayData[]>>[0]
export let refetchCalendar: ReturnType<typeof createResource<api.CalendarDayData[]>>[1]['refetch']
export let statsPanel: ReturnType<typeof createResource<api.StatsPanelData | null>>[0]
export let refetchStats: ReturnType<typeof createResource<api.StatsPanelData | null>>[1]['refetch']

export function installResources(): void {
  const taskFilters = createMemo(() =>
    buildTaskListFilters({
      activeView: activeView(),
      activeCategoryId: activeCategoryId(),
      activeTagId: activeTagId(),
      searchQuery: searchQuery() ?? '',
      activePriority: activePriority(),
      selectedDate: selectedDate(),
    }),
  )

  ;[tasks, { refetch: refetchTasks }] = createResource(
    () => ({ filters: taskFilters(), sort: { field: sortField(), direction: sortDir() } }),
    ({ filters, sort }) => {
      if (filters.is_archive) return api.listArchived()
      return api.listTasks(
        {
          status: filters.status ?? 'active',
          category_id: filters.category_id ?? null,
          tag_id: filters.tag_id ?? null,
          due_date: filters.due_date ?? null,
          search_query: filters.search_query ?? null,
          today_view: filters.today_view ?? null,
          overdue_view: null,
          priority: filters.priority ?? null,
        },
        sort,
      )
    },
    { initialValue: [] },
  )

  ;[categories, { refetch: refetchCategories }] = createResource(
    () => true, () => api.listCategories(), { initialValue: [] },
  )
  ;[tags, { refetch: refetchTags }] = createResource(
    () => true, () => api.listTags(), { initialValue: [] },
  )
  ;[taskDetail, { refetch: refetchDetail }] = createResource(
    selectedTaskId, (id) => (id ? api.getTask(id) : null),
  )
  ;[calendarData, { refetch: refetchCalendar }] = createResource(
    () => ({ year: calendarYear(), month: calendarMonth() }),
    ({ year, month }) => api.getCalendarMonth(year, month),
  )
  ;[statsPanel, { refetch: refetchStats }] = createResource(
    () => activeView() === 'stats',
    (active) => (active ? api.getStatsPanel(7) : null),
  )

  createEffect(() => { if (activeView() === 'stats') refetchStats() })
  createEffect(() => { void calendarYear(); void calendarMonth(); refetchCalendar() })
}
