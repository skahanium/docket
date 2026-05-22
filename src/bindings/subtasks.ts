import { invoke } from './core'

export function addSubtask(taskId: number, title: string): Promise<number> {
  return invoke<number>('add_subtask', { taskId, title })
}

export function updateSubtask(
  id: number,
  title?: string | null,
  status?: string | null,
): Promise<void> {
  return invoke<void>('update_subtask', { id, title, status })
}

export function deleteSubtask(id: number): Promise<void> {
  return invoke<void>('delete_subtask', { id })
}

export function reorderSubtasks(taskId: number, orderedIds: number[]): Promise<void> {
  return invoke<void>('reorder_subtasks', { taskId, orderedIds })
}
