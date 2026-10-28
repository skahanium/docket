/** Best-effort desktop OS flag for chrome layout (traffic lights, glass). */
export function isMacOS(): boolean {
  if (typeof navigator === 'undefined') return false
  return /Mac|Macintosh/.test(navigator.userAgent)
}

/** Stamp `data-platform` on `<html>` so CSS can pad around native window controls. */
export function markDocumentPlatform(): void {
  if (typeof document === 'undefined') return
  document.documentElement.dataset.platform = isMacOS() ? 'macos' : 'other'
}
