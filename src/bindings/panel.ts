import { invoke } from './core'
import type { TaskSummary } from './types'

export interface DesktopPanelSnapshot {
  today: TaskSummary[]
  overdue: TaskSummary[]
  generated_at: string
}

export function getDesktopPanelSnapshot(): Promise<DesktopPanelSnapshot> {
  return invoke<DesktopPanelSnapshot>('get_desktop_panel_snapshot')
}

export function focusTaskFromPanel(taskId: number): Promise<void> {
  return invoke<void>('focus_task_from_panel', { taskId })
}
