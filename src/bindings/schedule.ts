import { invoke } from './core'
import type { ScheduleDay } from './types'

export function getSchedule(date: string): Promise<ScheduleDay> {
  return invoke<ScheduleDay>('get_schedule', { date })
}

export function autoSchedule(date: string): Promise<ScheduleDay> {
  return invoke<ScheduleDay>('auto_schedule', { date })
}

export function updateScheduleEntry(
  taskId: number, date: string, startTime: string, durationMinutes: number,
): Promise<void> {
  return invoke<void>('update_schedule_entry', { taskId, date, startTime, durationMinutes })
}

export function removeScheduleEntry(taskId: number, date: string): Promise<void> {
  return invoke<void>('remove_schedule_entry', { taskId, date })
}

export function clearSchedule(date: string): Promise<void> {
  return invoke<void>('clear_schedule', { date })
}
