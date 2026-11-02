import type { MatterSummary, TaskSummary } from '../bindings/types'
import type { Facet } from '../stores/navigation'

export function filterMatterSummaries(rows: MatterSummary[], facet: Facet): MatterSummary[] {
  return rows.filter((m) => {
    if (facet.type === 'category') return m.category_id === facet.id
    return m.tags.some((t) => t.id === facet.id)
  })
}

export function filterTaskSummaries(rows: TaskSummary[], facet: Facet): TaskSummary[] {
  return rows.filter((t) => {
    if (facet.type === 'category') return t.category_id === facet.id
    return t.tags.some((tag) => tag.id === facet.id)
  })
}
