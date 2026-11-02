import { type Component, createSignal, createEffect, onMount, onCleanup, Show } from 'solid-js'
import { listen } from '@tauri-apps/api/event'
import styles from './TopBar.module.css'
import { isDesktopPanelVisible, toggleDesktopPanel } from '../../bindings/panel'
import { isRuntimeReady } from '../../bindings/core'

interface Props {
  searchValue: string
  onSearchInput: (v: string) => void
  onCreateClick: () => void
  onSettingsClick: () => void
}

const PanelIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
    <rect x="2.5" y="3" width="11" height="10" rx="1.5" />
    <path d="M5 6h6M5 8.5h4M5 11h3" />
  </svg>
)

const GearIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="8" cy="8" r="2.2" />
    <path d="M8 1.8v1.4M8 12.8v1.4M1.8 8h1.4M12.8 8h1.4M3.6 3.6l1 1M11.4 11.4l1 1M12.4 3.6l-1 1M4.6 11.4l-1 1" />
  </svg>
)

const TopBar: Component<Props> = (props) => {
  const [panelVisible, setPanelVisible] = createSignal(false)
  const [panelReady, setPanelReady] = createSignal(false)
  const [searchDraft, setSearchDraft] = createSignal(props.searchValue)
  let searchTimer: ReturnType<typeof setTimeout> | undefined

  createEffect(() => setSearchDraft(props.searchValue))

  const emitSearch = (value: string) => {
    if (searchTimer) clearTimeout(searchTimer)
    if (value === '') {
      props.onSearchInput('')
      return
    }
    searchTimer = setTimeout(() => props.onSearchInput(value), 200)
  }

  onCleanup(() => {
    if (searchTimer) clearTimeout(searchTimer)
  })

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
      <div class={styles.right}>
        <div class={styles.searchWrap}>
          <span class={styles.searchIcon}>
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
              <circle cx="7" cy="7" r="5" /><path d="M11 11l3 3" />
            </svg>
          </span>
          <input
            type="text" class={styles.searchInput}
            value={searchDraft()}
            onInput={(e) => {
              const v = e.currentTarget.value
              setSearchDraft(v)
              emitSearch(v)
            }}
            placeholder="搜索任务…"
          />
          {searchDraft() && (
            <button class={styles.clearBtn} onClick={() => { setSearchDraft(''); emitSearch('') }}>
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
          onClick={props.onSettingsClick}
          title="设置"
          aria-label="设置"
        >
          <GearIcon />
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
