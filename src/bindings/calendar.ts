import { invoke } from './core'
import type { CalendarDayData } from './types'

export function getCalendarMonth(year: number, month: number): Promise<CalendarDayData[]> {
  return invoke<CalendarDayData[]>('get_calendar_month', { year, month })
}
