import { invoke } from './core'
import type {
  CreateTaskInput,
  ListTasksFilters,
  SortOption,
  TaskSummary,
  TaskWithDetails,
  UpdateTaskInput,
} from './types'

export function createTask(input: CreateTaskInput): Promise<number> {
  return invoke<number>('create_task', { input })
}

export function updateTask(id: number, input: UpdateTaskInput): Promise<void> {
  return invoke<void>('update_task', { id, input })
}

export function completeTask(id: number): Promise<void> {
  return invoke<void>('complete_task', { id })
}

export function deleteTask(id: number): Promise<void> {
  return invoke<void>('delete_task', { id })
}

export function getTask(id: number): Promise<TaskWithDetails> {
  return invoke<TaskWithDetails>('get_task', { id })
}

export function listTasks(
  filters: ListTasksFilters,
  sort: SortOption,
): Promise<TaskSummary[]> {
  return invoke<TaskSummary[]>('list_tasks', { filters, sort })
}

export function archiveTask(id: number): Promise<void> {
  return invoke<void>('archive_task', { id })
}

export function restoreTask(id: number): Promise<void> {
  return invoke<void>('restore_task', { id })
}

export function listArchived(): Promise<TaskSummary[]> {
  return invoke<TaskSummary[]>('list_archived')
}
