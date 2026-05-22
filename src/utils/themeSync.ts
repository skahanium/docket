import { listen } from '@tauri-apps/api/event'
import { isRuntimeReady } from '../bindings/core'

export type ThemeMode = 'light' | 'dark' | 'system'
export type ResolvedTheme = 'light' | 'dark'

const STORAGE_KEY = 'docket-theme'

export function readThemeMode(): ThemeMode {
  const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null
  if (raw === 'light' || raw === 'dark' || raw === 'system') return raw
  return 'system'
}

export function resolveTheme(mode: ThemeMode): ResolvedTheme {
  if (mode === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  return mode
}

export function applyResolvedTheme(theme: ResolvedTheme): void {
  document.documentElement.setAttribute('data-theme', theme)
}

/** 供 panel / focus 等独立窗口与主窗主题保持一致 */
export function installCrossWindowThemeSync(): () => void {
  const syncFromStorage = () => applyResolvedTheme(resolveTheme(readThemeMode()))

  syncFromStorage()

  const onSystem = () => {
    if (readThemeMode() === 'system') syncFromStorage()
  }
  const mq = window.matchMedia('(prefers-color-scheme: dark)')
  mq.addEventListener('change', onSystem)

  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) syncFromStorage()
  }
  window.addEventListener('storage', onStorage)

  let unlistenTheme: (() => void) | undefined
  if (isRuntimeReady()) {
    void listen<ResolvedTheme>('theme-changed', (e) => {
      applyResolvedTheme(e.payload)
    }).then((fn) => {
      unlistenTheme = fn
    })
  }

  return () => {
    mq.removeEventListener('change', onSystem)
    window.removeEventListener('storage', onStorage)
    unlistenTheme?.()
  }
}
