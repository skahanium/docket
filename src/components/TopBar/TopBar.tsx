import { type Component, createSignal, onMount, onCleanup, Show } from 'solid-js'
import { listen } from '@tauri-apps/api/event'
import styles from './TopBar.module.css'
import { themeMode, setThemeMode, type ThemeMode } from '../../stores'
import { isDesktopPanelVisible, toggleDesktopPanel } from '../../bindings/panel'
import { isRuntimeReady } from '../../bindings/core'

interface Props {
  searchValue: string
  onSearchInput: (v: string) => void
  onCreateClick: () => void
}

const ICONS: Record<ThemeMode, () => any> = {
  light: () => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
      <circle cx="8" cy="8" r="4" />
      <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.5 3.5l1.5 1.5M11 11l1.5 1.5M12.5 3.5L11 5M5 11l-1.5 1.5" />
    </svg>
  ),
  dark: () => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
      <path d="M6 2a6 6 0 106 6 5 5 0 01-6-6z" />
    </svg>
  ),
  system: () => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
      <rect x="2" y="2" width="12" height="9" rx="1.5" />
      <path d="M5 14h6M8 11v3" />
    </svg>
  ),
}

const PanelIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
    <rect x="2.5" y="3" width="11" height="10" rx="1.5" />
    <path d="M5 6h6M5 8.5h4M5 11h3" />
  </svg>
)

const NEXT: Record<ThemeMode, ThemeMode> = { light: 'dark', dark: 'system', system: 'light' }
const TITLES: Record<ThemeMode, string> = { light: '日间模式', dark: '夜间模式', system: '跟随系统' }

const TopBar: Component<Props> = (props) => {
  const [panelVisible, setPanelVisible] = createSignal(false)
  const [panelReady, setPanelReady] = createSignal(false)

  onMount(() => {
    if (!isRuntimeReady()) return

    void isDesktopPanelVisible()
      .then(setPanelVisible)
      .catch(() => {})
      .finally(() => setPanelReady(true))

    const unlisten = listen<boolean>('panel-visibility', (e) => {
      setPanelVisible(e.payload)
    })

    onCleanup(() => {
      unlisten.then((fn) => fn())
    })
  })

  const togglePanel = () => {
    const next = !panelVisible()
    setPanelVisible(next)
    void toggleDesktopPanel()
      .then(setPanelVisible)
      .catch(() => {
        void isDesktopPanelVisible().then(setPanelVisible).catch(() => {})
      })
  }

  return (
    <header class={styles.bar} data-tauri-drag-region>
      <span class={styles.brand}>Docket</span>
      <div class={styles.right}>
        <div class={styles.searchWrap}>
          <span class={styles.searchIcon}>
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
              <circle cx="7" cy="7" r="5" /><path d="M11 11l3 3" />
            </svg>
          </span>
          <input
            type="text" class={styles.searchInput}
            value={props.searchValue}
            onInput={(e) => props.onSearchInput(e.currentTarget.value)}
            placeholder="搜索任务…"
          />
          {props.searchValue && (
            <button class={styles.clearBtn} onClick={() => props.onSearchInput('')}>
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                <path d="M4 4l8 8M12 4l-8 8" />
              </svg>
            </button>
          )}
        </div>

        <Show when={panelReady()}>
          <button
            type="button"
            class={`${styles.iconBtn} ${panelVisible() ? styles.iconBtnActive : ''}`}
            onClick={togglePanel}
            title={panelVisible() ? '隐藏桌面任务面板' : '显示桌面任务面板'}
            aria-pressed={panelVisible()}
            aria-label="桌面任务面板"
          >
            <PanelIcon />
          </button>
        </Show>

        <button
          type="button"
          class={styles.iconBtn}
          onClick={() => setThemeMode(NEXT[themeMode()])}
          title={TITLES[themeMode()]}
          aria-label={TITLES[themeMode()]}
        >
          {ICONS[themeMode()]()}
        </button>

        <button class={styles.newBtn} onClick={props.onCreateClick}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <path d="M8 3v10M3 8h10" />
          </svg>
          新建
        </button>
      </div>
    </header>
  )
}

export default TopBar
