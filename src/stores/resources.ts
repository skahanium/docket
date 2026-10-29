import { createResource, createMemo, createEffect } from 'solid-js'
import * as api from '../bindings/commands'
import { activeView, selectedMatterId, selectedTaskId } from './navigation'
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
import type { AgendaItem, Cadence, MatterDetail, MatterSummary, Playbook } from '../bindings/types'

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
export let agenda: ReturnType<typeof createResource<AgendaItem[]>>[0]
export let refetchAgenda: ReturnType<typeof createResource<AgendaItem[]>>[1]['refetch']
export let matters: ReturnType<typeof createResource<MatterSummary[]>>[0]
export let refetchMatters: ReturnType<typeof createResource<MatterSummary[]>>[1]['refetch']
export let playbooks: ReturnType<typeof createResource<Playbook[]>>[0]
export let refetchPlaybooks: ReturnType<typeof createResource<Playbook[]>>[1]['refetch']
export let cadences: ReturnType<typeof createResource<Cadence[]>>[0]
export let refetchCadences: ReturnType<typeof createResource<Cadence[]>>[1]['refetch']
export let matterDetail: ReturnType<typeof createResource<MatterDetail | null>>[0]
export let refetchMatterDetail: ReturnType<typeof createResource<MatterDetail | null>>[1]['refetch']

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
          overdue_view: filters.overdue_view ?? null,
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
    () => {
      const view = activeView()
      if (view !== 'calendar' && view !== 'schedule') return undefined
      return { year: calendarYear(), month: calendarMonth() }
    },
    (params) =>
      params ? api.getCalendarMonth(params.year, params.month) : Promise.resolve([]),
    { initialValue: [] },
  )
  ;[statsPanel, { refetch: refetchStats }] = createResource(
    () => activeView() === 'stats',
    (active) => (active ? api.getStatsPanel(7) : null),
  )

  createEffect(() => { if (activeView() === 'stats') refetchStats() })

  ;[agenda, { refetch: refetchAgenda }] = createResource(
    () => {
      const view = activeView()
      if (view !== 'today' && view !== 'overdue') return undefined
      return view
    },
    (view) => api.listAgenda(view),
    { initialValue: [] },
  )

  ;[matters, { refetch: refetchMatters }] = createResource(
    () => {
      const view = activeView()
      if (view !== 'matters' && selectedMatterId() == null) return undefined
      return true
    },
    () => api.listMatters(),
    { initialValue: [] },
  )

  ;[playbooks, { refetch: refetchPlaybooks }] = createResource(
    () => {
      const view = activeView()
      if (view !== 'playbooks' && view !== 'cadences' && view !== 'matters' && selectedMatterId() == null) {
        return undefined
      }
      return true
    },
    () => api.listPlaybooks(true),
    { initialValue: [] },
  )

  ;[cadences, { refetch: refetchCadences }] = createResource(
    () => (activeView() === 'cadences' ? true : undefined),
    () => api.listCadences(),
    { initialValue: [] },
  )

  ;[matterDetail, { refetch: refetchMatterDetail }] = createResource(
    selectedMatterId,
    (id) => (id ? api.getMatter(id) : null),
  )
}
