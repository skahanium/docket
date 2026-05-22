import { invoke } from './core'
import type { HolidayEntry, Settings } from './types'

export function getSettings(): Promise<Settings> {
  return invoke<Settings>('get_settings')
}

export function updateSettings(settings: Settings): Promise<void> {
  return invoke<void>('update_settings', { settings })
}

export function isWorkday(date: string): Promise<boolean> {
  return invoke<boolean>('is_workday', { date })
}

export function listHolidays(): Promise<HolidayEntry[]> {
  return invoke<HolidayEntry[]>('list_holidays')
}

export function updateHolidays(holidays: HolidayEntry[]): Promise<void> {
  return invoke<void>('update_holidays', { holidays })
}

export function fetchHolidaysOnline(
  year: number | undefined,
  userConfirmed: boolean,
): Promise<HolidayEntry[]> {
  return invoke<HolidayEntry[]>('fetch_holidays_online', { year, userConfirmed })
}

export function getDatabasePath(): Promise<string> {
  return invoke<string>('get_database_path')
}

export function revealDatabaseFolder(): Promise<void> {
  return invoke<void>('reveal_database_folder')
}
