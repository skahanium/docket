import type { AgendaItem } from '../bindings/types'

export function agendaRowCopy(item: AgendaItem): { title: string; subtitle?: string } {
  if (item.kind === 'matter_step') {
    return { title: item.title, subtitle: item.subtitle ?? undefined }
  }
  return { title: item.title }
}

export function filterAgendaItems(
  items: AgendaItem[],
  filters: {
    search: string
    priority: number | null
    categoryId: number | null
    tagId: number | null
  },
): AgendaItem[] {
  const q = filters.search.trim().toLowerCase()
  return items.filter((item) => {
    if (filters.priority != null && item.priority !== filters.priority) return false
    if (filters.categoryId != null && item.category_id !== filters.categoryId) return false
    if (filters.tagId != null && !item.tag_ids.some((id) => id === filters.tagId)) return false
    if (!q) return true
    const hay = `${item.title} ${item.subtitle ?? ''}`.toLowerCase()
    return hay.includes(q)
  })
}
