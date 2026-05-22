import { createSignal, createEffect, onCleanup } from 'solid-js'

export type ThemeMode = 'light' | 'dark' | 'system'
export type ResolvedTheme = 'light' | 'dark'

const stored = (typeof localStorage !== 'undefined' ? localStorage.getItem('docket-theme') : null) as ThemeMode | null

export let themeMode: ReturnType<typeof createSignal<ThemeMode>>[0]
export let setThemeMode: ReturnType<typeof createSignal<ThemeMode>>[1]
export let resolvedTheme: ReturnType<typeof createSignal<ResolvedTheme>>[0]

export function installTheme(): void {
  ;[themeMode, setThemeMode] = createSignal<ThemeMode>(stored ?? 'system')
  const systemDark = typeof window !== 'undefined' ? window.matchMedia('(prefers-color-scheme: dark)') : null
  let setResolvedTheme: (v: ResolvedTheme) => ResolvedTheme
  ;[resolvedTheme, setResolvedTheme] = createSignal<ResolvedTheme>(
    themeMode() === 'system' ? (systemDark?.matches ? 'dark' : 'light') : themeMode() as ResolvedTheme,
  )

  createEffect(() => {
    const mode = themeMode()
    if (mode === 'system') {
      const dark = systemDark?.matches ?? false
      setResolvedTheme(dark ? 'dark' : 'light')
    } else {
      setResolvedTheme(mode as ResolvedTheme)
    }
  })

  createEffect(() => {
    const theme = resolvedTheme()
    document.documentElement.setAttribute('data-theme', theme)
    if (typeof localStorage !== 'undefined') localStorage.setItem('docket-theme', themeMode())
  })

  if (systemDark) {
    const handler = () => {
      if (themeMode() === 'system') {
        setResolvedTheme(systemDark.matches ? 'dark' : 'light')
      }
    }
    systemDark.addEventListener('change', handler)
    onCleanup(() => systemDark.removeEventListener('change', handler))
  }
}
