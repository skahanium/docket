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
    const out = filterAgendaItems([task, step], { search: '张三', priority: null })
    expect(out).toHaveLength(1)
    expect(out[0].id).toBe(9)
  })

  it('filters by priority', () => {
    const out = filterAgendaItems([task, step], { search: '', priority: 2 })
    expect(out.map((i) => i.id)).toEqual([9])
  })
})
