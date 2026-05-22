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
  const target = parseLocalDate(dateStr).getTime()
  const today = parseLocalDate(localDateString()).getTime()
  return Math.round((target - today) / 86_400_000)
}
