import { createSignal } from 'solid-js'
import { activeView, selectedTaskId } from './navigation'
import {
  refetchTasks,
  refetchCalendar,
  refetchDetail,
  refetchStats,
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
  /** Refetch statistics when on the stats view (default: true when on stats). */
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
    stats = activeView() === 'stats',
  } = options

  if (tasks) void refetchTasks()
  if (calendar) void refetchCalendar()
  if (detail) void refetchDetail()
  if (stats) void refetchStats()
  bumpTaskMutationEpoch?.()
}
