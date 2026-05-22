import { createRoot } from 'solid-js'
import { installAppStore } from './install'

createRoot(installAppStore)

export type { ThemeMode, ResolvedTheme } from './theme'
export { themeMode, setThemeMode, resolvedTheme } from './theme'

export type { ViewKind } from './navigation'
export {
  activeView,
  setActiveView,
  selectedTaskId,
  setSelectedTaskId,
  selectTask,
  deselectTask,
} from './navigation'

export type { SortField, SortDir } from './filtersSort'
export {
  searchQuery,
  setSearchQuery,
  activeCategoryId,
  setActiveCategoryId,
  activeTagId,
  setActiveTagId,
  activePriority,
  setActivePriority,
  sortField,
  setSortField,
  sortDir,
  setSortDir,
  clearFilters,
} from './filtersSort'

export {
  calendarYear,
  setCalendarYear,
  calendarMonth,
  setCalendarMonth,
  selectedDate,
  setSelectedDate,
} from './calendarUi'

export type { Toast } from './toast'
export { toasts, setToasts, pushToast } from './toast'

export {
  tasks,
  refetchTasks,
  categories,
  refetchCategories,
  tags,
  refetchTags,
  taskDetail,
  refetchDetail,
  calendarData,
  refetchCalendar,
  statsPanel,
  refetchStats,
} from './resources'

export { taskMutationEpoch, invalidateAfterTaskMutation } from './invalidate'
export type { InvalidateTaskMutationOptions } from './invalidate'

export { reviewOpen, setReviewOpen, scheduleDailyReviewCheck } from './appChrome'

export * from './apiActions'
export { completeTaskFromList } from './listActions'
