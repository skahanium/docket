import { invoke } from './core'
import type { Tag } from './types'

export function createTag(name: string, color?: string | null): Promise<number> {
  return invoke<number>('create_tag', { name, color })
}

export function listTags(): Promise<Tag[]> {
  return invoke<Tag[]>('list_tags')
}

export function updateTag(id: number, name?: string | null, color?: string | null): Promise<void> {
  return invoke<void>('update_tag', { id, name, color })
}

export function deleteTag(id: number): Promise<void> {
  return invoke<void>('delete_tag', { id })
}

export function addTagToTask(taskId: number, tagId: number): Promise<void> {
  return invoke<void>('add_tag_to_task', { taskId, tagId })
}

export function removeTagFromTask(taskId: number, tagId: number): Promise<void> {
  return invoke<void>('remove_tag_from_task', { taskId, tagId })
}
