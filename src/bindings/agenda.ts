import { invoke } from './core'
import type { AgendaItem } from './types'

export function listAgenda(view: 'today' | 'overdue'): Promise<AgendaItem[]> {
  return invoke<AgendaItem[]>('list_agenda', { view })
}
