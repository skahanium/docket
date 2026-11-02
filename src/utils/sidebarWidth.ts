export const SIDEBAR_WIDTH_MIN = 200
export const SIDEBAR_WIDTH_MAX = 360
export const SIDEBAR_WIDTH_DEFAULT = 260
export const SIDEBAR_WIDTH_KEY = 'docket-sidebar-width'
export const MAIN_MIN_WIDTH = 480
export const SIDEBAR_WIDTH_VAR = '--sidebar-width'

export function viewportWidth(): number {
  if (typeof window === 'undefined') return 1280
  const w = window.innerWidth
  return Number.isFinite(w) && w > 0 ? w : 1280
}

/** Hard 200–360, ignoring the window. Used for storage. */
export function clampSidebarPreferred(n: number): number {
  if (!Number.isFinite(n)) return SIDEBAR_WIDTH_DEFAULT
  return Math.min(SIDEBAR_WIDTH_MAX, Math.max(SIDEBAR_WIDTH_MIN, Math.round(n)))
}

/** Widest the sidebar may be while leaving the main pane usable. */
export function sidebarWidthMax(viewport = viewportWidth()): number {
  return Math.min(
    SIDEBAR_WIDTH_MAX,
    Math.max(SIDEBAR_WIDTH_MIN, viewport - MAIN_MIN_WIDTH),
  )
}

/** Display width: preferred range ∩ leftover main column. */
export function clampSidebarWidth(n: number, viewport = viewportWidth()): number {
  return Math.min(clampSidebarPreferred(n), sidebarWidthMax(viewport))
}

export function readStoredSidebarWidth(): number {
  if (typeof localStorage === 'undefined') return SIDEBAR_WIDTH_DEFAULT
  try {
    const raw = localStorage.getItem(SIDEBAR_WIDTH_KEY)
    if (raw == null || raw === '') return SIDEBAR_WIDTH_DEFAULT
    return clampSidebarPreferred(Number(raw))
  } catch {
    return SIDEBAR_WIDTH_DEFAULT
  }
}

export function persistSidebarWidth(n: number): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, String(clampSidebarPreferred(n)))
  } catch { /* ignore quota / private mode */ }
}

export function applySidebarWidthVar(px: number): void {
  if (typeof document === 'undefined') return
  document.documentElement.style.setProperty(SIDEBAR_WIDTH_VAR, `${clampSidebarWidth(px)}px`)
}
