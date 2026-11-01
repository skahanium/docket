/** Local calendar date as `YYYY-MM-DD` (avoids `toISOString()` UTC shift). */
export function localDateString(d: Date = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** Add calendar days in local timezone; returns `YYYY-MM-DD`. */
export function addDaysLocal(dateStr: string, days: number): string {
  const d = parseLocalDate(dateStr)
  d.setDate(d.getDate() + days)
  return localDateString(d)
}

/** Whole-day offset from today (local): negative = past, positive = future. */
export function dayDiffFromToday(dateStr: string): number {
  const target = parseLocalDate(dueDay(dateStr) ?? dateStr).getTime()
  const today = parseLocalDate(localDateString()).getTime()
  return Math.round((target - today) / 86_400_000)
}

export function dueDay(value: string | null | undefined): string | null {
  if (!value) return null
  const day = value.slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : null
}

export function dueTime(value: string | null | undefined): string {
  if (value && value.length >= 16 && value[10] === 'T') return value.slice(11, 16)
  return ''
}

export function composeDue(date: string, time: string): string | null {
  const day = date.trim()
  if (!day) return null
  const clock = time.trim()
  return clock ? `${day}T${clock}` : day
}

export function isOverdueDue(due: string | null | undefined, today: string = localDateString()): boolean {
  const day = dueDay(due)
  return !!day && day < today
}

export function formatDue(due: string): string {
  const day = dueDay(due) ?? due
  const clock = dueTime(due)
  return clock ? `${day} ${clock}` : day
}

export function replaceDueDay(existing: string | null | undefined, nextDay: string): string {
  const clock = dueTime(existing)
  return clock ? `${nextDay}T${clock}` : nextDay
}
