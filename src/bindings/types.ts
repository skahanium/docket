/**
 * IPC types — generated from Rust via `npm run generate:bindings`.
 */
import type {
  AddMatterStepInput as GeneratedAddMatterStepInput,
  CreateBlankMatterInput as GeneratedCreateBlankMatterInput,
  CreateCadenceInput as GeneratedCreateCadenceInput,
  CreateMatterInput as GeneratedCreateMatterInput,
  CreateTaskInput as GeneratedCreateTaskInput,
  ListTasksFilters as GeneratedListTasksFilters,
  UpdateCadenceInput as GeneratedUpdateCadenceInput,
  UpdateMatterInput as GeneratedUpdateMatterInput,
  UpdateMatterStepInput as GeneratedUpdateMatterStepInput,
  UpdatePlaybookInput as GeneratedUpdatePlaybookInput,
  UpdateTaskInput as GeneratedUpdateTaskInput,
} from './generated'

export type {
  AgendaItem,
  Cadence,
  CadenceProgress,
  CalendarDay,
  Category,
  DailyAccuracy,
  DailyCount,
  DailyReview,
  FocusHeatmapEntry,
  FocusSession,
  FocusSummary,
  HolidayEntry,
  MatterDetail,
  MatterStep,
  MatterStepBrief,
  MatterStepLink,
  MatterSummary,
  Playbook,
  PlaybookStep,
  PlaybookStepInput,
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
  AddStepLinkInput,
  CreatePlaybookInput,
} from './generated'

export type { CalendarDay as CalendarDayData } from './generated'

export type UpdateTaskInput = Partial<GeneratedUpdateTaskInput>

export type CreateTaskInput = Pick<GeneratedCreateTaskInput, 'title'> &
  Partial<Omit<GeneratedCreateTaskInput, 'title'>>

export type ListTasksFilters = Partial<GeneratedListTasksFilters>

export type UpdateMatterInput = Partial<GeneratedUpdateMatterInput>
export type UpdateMatterStepInput = Partial<GeneratedUpdateMatterStepInput>
export type UpdatePlaybookInput = Partial<GeneratedUpdatePlaybookInput>
export type UpdateCadenceInput = Partial<GeneratedUpdateCadenceInput>
export type AddMatterStepInput = Pick<GeneratedAddMatterStepInput, 'title'> &
  Partial<Omit<GeneratedAddMatterStepInput, 'title'>>
export type CreateMatterInput = Pick<GeneratedCreateMatterInput, 'title' | 'playbook_id'> &
  Partial<Omit<GeneratedCreateMatterInput, 'title' | 'playbook_id'>>
export type CreateBlankMatterInput = Pick<GeneratedCreateBlankMatterInput, 'title'> &
  Partial<Omit<GeneratedCreateBlankMatterInput, 'title'>>
export type CreateCadenceInput = Pick<GeneratedCreateCadenceInput, 'title' | 'period'> &
  Partial<Omit<GeneratedCreateCadenceInput, 'title' | 'period'>>
