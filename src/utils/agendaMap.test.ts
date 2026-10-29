import { describe, expect, it } from 'vitest'
import { agendaRowCopy, filterAgendaItems } from './agendaMap'
import type { AgendaItem } from '../bindings/types'

const task: AgendaItem = {
  kind: 'task',
  id: 1,
  title: '写周报',
  subtitle: null,
  due_date: '2026-10-29',
  priority: 1,
  matter_id: null,
  missing_evidence: false,
  category_id: 1,
  tag_ids: [1],
}

const step: AgendaItem = {
  kind: 'matter_step',
  id: 9,
  title: '收材料',
  subtitle: '张三案',
  due_date: null,
  priority: 2,
  matter_id: 3,
  missing_evidence: true,
  category_id: null,
  tag_ids: [],
}

const uncategorized: AgendaItem = {
  ...task,
  id: 2,
  title: '无分类',
  category_id: null,
  tag_ids: [1],
}

describe('agendaRowCopy', () => {
  it('keeps task title only', () => {
    expect(agendaRowCopy(task)).toEqual({ title: '写周报' })
  })

  it('pairs step title with matter name', () => {
    expect(agendaRowCopy(step)).toEqual({ title: '收材料', subtitle: '张三案' })
  })
})

describe('filterAgendaItems', () => {
  it('filters by search across title and subtitle', () => {
    const out = filterAgendaItems([task, step], { search: '张三', priority: null, categoryId: null, tagId: null })
    expect(out).toHaveLength(1)
    expect(out[0].id).toBe(9)
  })

  it('filters by priority', () => {
    const out = filterAgendaItems([task, step], { search: '', priority: 2, categoryId: null, tagId: null })
    expect(out.map((i) => i.id)).toEqual([9])
  })

  it('filters by category and excludes uncategorized', () => {
    const out = filterAgendaItems([task, step, uncategorized], {
      search: '',
      priority: null,
      categoryId: 1,
      tagId: null,
    })
    expect(out.map((i) => i.id)).toEqual([1])
  })

  it('filters by tag membership', () => {
    const other = { ...step, id: 10, tag_ids: [2] }
    const out = filterAgendaItems([task, other], {
      search: '',
      priority: null,
      categoryId: null,
      tagId: 1,
    })
    expect(out.map((i) => i.id)).toEqual([1])
  })

  it('filters matter steps by matter category and tags', () => {
    const taggedStep: AgendaItem = { ...step, id: 11, category_id: 1, tag_ids: [1] }
    const byCat = filterAgendaItems([task, step, taggedStep, uncategorized], {
      search: '',
      priority: null,
      categoryId: 1,
      tagId: null,
    })
    expect(byCat.map((i) => i.id)).toEqual([1, 11])
    const byTag = filterAgendaItems([task, taggedStep, { ...step, id: 12, tag_ids: [2] }], {
      search: '',
      priority: null,
      categoryId: null,
      tagId: 1,
    })
    expect(byTag.map((i) => i.id)).toEqual([1, 11])
  })
})
