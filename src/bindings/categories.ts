import { invoke } from './core'
import type { Category } from './types'

export function createCategory(name: string, color?: string | null, parentId?: number | null): Promise<number> {
  return invoke<number>('create_category', { name, color, parentId })
}

export function listCategories(): Promise<Category[]> {
  return invoke<Category[]>('list_categories')
}

export function updateCategory(id: number, name?: string | null, color?: string | null): Promise<void> {
  return invoke<void>('update_category', { id, name, color })
}

export function deleteCategory(id: number): Promise<void> {
  return invoke<void>('delete_category', { id })
}
