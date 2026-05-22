import { createSignal } from 'solid-js'

export let searchQuery: ReturnType<typeof createSignal<string>>[0]
export let setSearchQuery: ReturnType<typeof createSignal<string>>[1]
export let activeCategoryId: ReturnType<typeof createSignal<number | null>>[0]
export let setActiveCategoryId: ReturnType<typeof createSignal<number | null>>[1]
export let activeTagId: ReturnType<typeof createSignal<number | null>>[0]
export let setActiveTagId: ReturnType<typeof createSignal<number | null>>[1]
export let activePriority: ReturnType<typeof createSignal<number | null>>[0]
export let setActivePriority: ReturnType<typeof createSignal<number | null>>[1]

export type SortField = 'created_at' | 'due_date' | 'priority' | 'title'
export type SortDir = 'asc' | 'desc'
export let sortField: ReturnType<typeof createSignal<SortField>>[0]
export let setSortField: ReturnType<typeof createSignal<SortField>>[1]
export let sortDir: ReturnType<typeof createSignal<SortDir>>[0]
export let setSortDir: ReturnType<typeof createSignal<SortDir>>[1]

export let clearFilters: () => void

export function installFiltersSort(): void {
  ;[sortField, setSortField] = createSignal<SortField>('due_date')
  ;[sortDir, setSortDir] = createSignal<SortDir>('asc')
  ;[searchQuery, setSearchQuery] = createSignal('')
  ;[activeCategoryId, setActiveCategoryId] = createSignal<number | null>(null)
  ;[activeTagId, setActiveTagId] = createSignal<number | null>(null)
  ;[activePriority, setActivePriority] = createSignal<number | null>(null)

  clearFilters = () => {
    setSearchQuery('')
    setActiveCategoryId(null)
    setActiveTagId(null)
    setActivePriority(null)
  }
}
