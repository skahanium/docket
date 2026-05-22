/**
 * IPC types — generated from Rust via `npm run generate:bindings`.
 */
import type {
  CreateTaskInput as GeneratedCreateTaskInput,
  ListTasksFilters as GeneratedListTasksFilters,
  UpdateTaskInput as GeneratedUpdateTaskInput,
} from './generated'

export type {
  CalendarDay,
  Category,
  DailyAccuracy,
  DailyCount,
  DailyReview,
  FocusHeatmapEntry,
  FocusSession,
  FocusSummary,
  HolidayEntry,
  Reminder,
  ReviewTask,
  ScheduleDay,
  ScheduleEntry,
  Settings,
  SortOption,
  Statistics,
  StatsPanelData,
  Subtask,
  SubtaskProgress,
  Tag,
  TaskSummary,
  TaskWithDetails,
  TimeBlock,
  WeeklyAccuracy,
  WorkloadSummary,
} from './generated'

export type { CalendarDay as CalendarDayData } from './generated'

export type UpdateTaskInput = Partial<GeneratedUpdateTaskInput>

export type CreateTaskInput = Pick<GeneratedCreateTaskInput, 'title'> &
  Partial<Omit<GeneratedCreateTaskInput, 'title'>>

export type ListTasksFilters = Partial<GeneratedListTasksFilters>
