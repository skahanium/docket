/** `period_end` 为不含的次日 YYYY-MM-DD，返回期间最后一天。 */
export function inclusiveEndDate(endExclusive: string): string {
  const [y, m, d] = endExclusive.split('-').map(Number)
  const prev = new Date(Date.UTC(y, m - 1, d) - 24 * 60 * 60 * 1000)
  const yy = prev.getUTCFullYear()
  const mm = String(prev.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(prev.getUTCDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}
