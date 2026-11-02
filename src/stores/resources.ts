import { createResource, createMemo } from 'solid-js'
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
import { settingsOpen } from './appChrome'
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
export let overdueAgenda: ReturnType<typeof createResource<AgendaItem[]>>[0]
export let refetchAgenda: () => void = () => {}
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
    () => {
      const view = activeView()
      if (view !== 'tasks' && view !== 'calendar') return undefined
      if (view === 'calendar' && !selectedDate()) return undefined
      return { filters: taskFilters(), sort: { field: sortField(), direction: sortDir() } }
    },
    ({ filters, sort }) =>
      api.listTasks(
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
      ),
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
      if (activeView() !== 'calendar') return undefined
      return { year: calendarYear(), month: calendarMonth() }
    },
    (params) =>
      params ? api.getCalendarMonth(params.year, params.month) : Promise.resolve([]),
    { initialValue: [] },
  )
  ;[statsPanel, { refetch: refetchStats }] = createResource(
    () => activeView() === 'progress',
    (active) => (active ? api.getStatsPanel(7) : null),
  )

  let refetchAgendaToday: ReturnType<typeof createResource<AgendaItem[]>>[1]['refetch']
  let refetchAgendaOverdue: ReturnType<typeof createResource<AgendaItem[]>>[1]['refetch']

  ;[agenda, { refetch: refetchAgendaToday }] = createResource(
    () => (activeView() === 'today' ? 'today' as const : undefined),
    (view) => api.listAgenda(view),
    { initialValue: [] },
  )
  ;[overdueAgenda, { refetch: refetchAgendaOverdue }] = createResource(
    () => (activeView() === 'today' ? 'overdue' as const : undefined),
    (view) => api.listAgenda(view),
    { initialValue: [] },
  )
  refetchAgenda = () => {
    void refetchAgendaToday()
    void refetchAgendaOverdue()
  }

  ;[matters, { refetch: refetchMatters }] = createResource(
    () => {
      if (activeView() !== 'matters' && selectedMatterId() == null) return undefined
      return true
    },
    () => api.listMatters(),
    { initialValue: [] },
  )

  ;[playbooks, { refetch: refetchPlaybooks }] = createResource(
    () => {
      const view = activeView()
      if (
        view !== 'progress'
        && view !== 'matters'
        && !settingsOpen()
        && selectedMatterId() == null
      ) {
        return undefined
      }
      return true
    },
    () => api.listPlaybooks(true),
    { initialValue: [] },
  )

  ;[cadences, { refetch: refetchCadences }] = createResource(
    () => {
      const view = activeView()
      if (
        view !== 'progress'
        && view !== 'matters'
        && !settingsOpen()
        && selectedMatterId() == null
      ) {
        return undefined
      }
      return true
    },
    () => api.listCadences(),
    { initialValue: [] },
  )

  ;[matterDetail, { refetch: refetchMatterDetail }] = createResource(
    selectedMatterId,
    (id) => (id ? api.getMatter(id) : null),
  )
}
