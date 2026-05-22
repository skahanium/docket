import { invoke } from './core'
import type { Reminder } from './types'

export function addReminder(taskId: number, remindAt: string): Promise<number> {
  return invoke<number>('add_reminder', { taskId, remindAt })
}

export function removeReminder(id: number): Promise<void> {
  return invoke<void>('remove_reminder', { id })
}

export function listReminders(taskId: number): Promise<Reminder[]> {
  return invoke<Reminder[]>('list_reminders', { taskId })
}
