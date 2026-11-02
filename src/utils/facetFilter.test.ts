import { describe, expect, it } from 'vitest'
import { filterMatterSummaries, filterTaskSummaries } from './facetFilter'
import type { MatterSummary, TaskSummary } from '../bindings/types'

function matter(partial: Partial<MatterSummary> & Pick<MatterSummary, 'id' | 'title'>): MatterSummary {
  return {
    playbook_id: null,
    status: 'active',
    priority: 0,
    category_id: null,
    due_date: null,
    created_at: '2026-11-02T00:00:00Z',
    completed_at: null,
    tags: [],
    current_step: null,
    missing_evidence: false,
    ...partial,
  }
}

describe('filterMatterSummaries', () => {
  const personal = matter({ id: 1, title: '个人案', category_id: 3, tags: [{ id: 7, name: '手测', color: null }] })
  const work = matter({ id: 2, title: '工作案', category_id: 4, tags: [{ id: 8, name: '其他', color: null }] })
  const none = matter({ id: 3, title: '未分类' })

  it('keeps matters in the open category', () => {
    expect(filterMatterSummaries([personal, work, none], { type: 'category', id: 3 }).map((m) => m.id)).toEqual([1])
  })

  it('keeps matters that include the open tag', () => {
    expect(filterMatterSummaries([personal, work, none], { type: 'tag', id: 7 }).map((m) => m.id)).toEqual([1])
  })

  it('excludes uncategorized or untagged rows', () => {
    expect(filterMatterSummaries([none], { type: 'category', id: 3 })).toEqual([])
    expect(filterMatterSummaries([none], { type: 'tag', id: 7 })).toEqual([])
  })
})

describe('filterTaskSummaries', () => {
  const personal: TaskSummary = {
    id: 1,
    title: '个人任务',
    status: 'active',
    priority: 0,
    due_date: null,
    category_id: 3,
    created_at: '2026-11-02T00:00:00Z',
    tags: [{ id: 7, name: '手测', color: null }],
    subtasks_progress: { total: 0, completed: 0 },
  }
  const other: TaskSummary = {
    ...personal,
    id: 2,
    title: '其他',
    category_id: 4,
    tags: [],
  }

  it('keeps tasks in the open category or tag', () => {
    expect(filterTaskSummaries([personal, other], { type: 'category', id: 3 }).map((t) => t.id)).toEqual([1])
    expect(filterTaskSummaries([personal, other], { type: 'tag', id: 7 }).map((t) => t.id)).toEqual([1])
  })
})
