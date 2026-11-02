import { createSignal } from 'solid-js'
import { activeView, selectedMatterId, selectedTaskId } from './navigation'
import {
  refetchTasks,
  refetchCalendar,
  refetchDetail,
  refetchStats,
  refetchAgenda,
  refetchMatters,
  refetchPlaybooks,
  refetchCadences,
  refetchMatterDetail,
} from './resources'

/** Bumped on every task mutation so stats-panel auxiliary resources re-fetch. */
export let taskMutationEpoch: ReturnType<typeof createSignal<number>>[0] = () => 0

let bumpTaskMutationEpoch: (() => void) | undefined

export function installInvalidate(): void {
  let bump: (v: number | ((prev: number) => number)) => number
  ;[taskMutationEpoch, bump] = createSignal(0)
  bumpTaskMutationEpoch = () => {
    bump((n) => n + 1)
  }
}

export type InvalidateTaskMutationOptions = {
  /** Refetch the task list (default: true). */
  tasks?: boolean
  /** Refetch the main calendar month grid (default: true). */
  calendar?: boolean
  /** Refetch the open task detail panel (default: true when a task is selected). */
  detail?: boolean
  /** Refetch statistics when on the progress view (default: true when on progress). */
  stats?: boolean
}

/**
 * Central cache invalidation after any change that affects tasks, due dates,
 * completion state, or focus time aggregates shown in list/calendar/stats views.
 */
export function invalidateAfterTaskMutation(
  options: InvalidateTaskMutationOptions = {},
): void {
  const {
    tasks = true,
    calendar = true,
    detail = selectedTaskId() != null,
    stats = activeView() === 'progress',
  } = options

  if (tasks) void refetchTasks()
  if (calendar) void refetchCalendar()
  if (detail) void refetchDetail()
  if (stats) void refetchStats()
  void refetchAgenda()
  void refetchMatters()
  void refetchPlaybooks()
  void refetchCadences()
  if (selectedMatterId() != null) void refetchMatterDetail()
  bumpTaskMutationEpoch?.()
}

/** Alias used after matter / playbook / cadence writes. */
export const invalidateAfterMutation = invalidateAfterTaskMutation
