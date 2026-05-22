import { invoke } from './core'
import type { FocusSession, FocusSummary } from './types'

export function startFocus(taskId: number): Promise<FocusSession> {
  return invoke<FocusSession>('start_focus', { taskId })
}

export function stopFocus(sessionId: number, completed?: boolean): Promise<FocusSession> {
  return invoke<FocusSession>('stop_focus', { sessionId, completed })
}

export function abandonFocus(sessionId: number): Promise<void> {
  return invoke<void>('abandon_focus', { sessionId })
}

export function getCurrentFocus(): Promise<FocusSession | null> {
  return invoke<FocusSession | null>('get_current_focus')
}

export function getTaskFocusHistory(taskId: number): Promise<FocusSession[]> {
  return invoke<FocusSession[]>('get_task_focus_history', { taskId })
}

export function getFocusSummary(date: string): Promise<FocusSummary> {
  return invoke<FocusSummary>('get_focus_summary', { date })
}

export function updateTaskEstimate(taskId: number, minutes: number): Promise<void> {
  return invoke<void>('update_task_estimate', { taskId, minutes })
}
