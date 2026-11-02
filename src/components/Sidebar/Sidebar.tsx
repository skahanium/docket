import { type Component, For, createEffect, createSignal, onCleanup, onMount } from 'solid-js'
import styles from './Sidebar.module.css'
import type { ViewKind, Facet } from '../../stores'
import { isFacetActive, isTrackActive } from '../../stores'
import type { Category, Tag } from '../../bindings/types'
import {
  SIDEBAR_WIDTH_DEFAULT,
  SIDEBAR_WIDTH_MIN,
  applySidebarWidthVar,
  clampSidebarPreferred,
  clampSidebarWidth,
  persistSidebarWidth,
  readStoredSidebarWidth,
  sidebarWidthMax,
} from '../../utils/sidebarWidth'

interface Props {
  activeView: ViewKind
  openFacet: Facet | null
  categories: Category[]
  tags: Tag[]
  settingsOpen?: boolean
  onViewChange: (v: ViewKind) => void
  onFacetSelect: (facet: Facet) => void
  onSettingsClick: () => void
}

const VIEWS: { key: ViewKind; label: string }[] = [
  { key: 'today', label: '今日' },
  { key: 'tasks', label: '任务' },
  { key: 'matters', label: '事项' },
  { key: 'calendar', label: '日历' },
  { key: 'progress', label: '进展' },
]

const GearIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
  </svg>
)

const Sidebar: Component<Props> = (props) => {
  let preferred = readStoredSidebarWidth()
  const [width, setWidth] = createSignal(clampSidebarWidth(preferred))
  const [dragging, setDragging] = createSignal(false)
  let dragOriginX = 0
  let dragOriginW = SIDEBAR_WIDTH_DEFAULT
  applySidebarWidthVar(width())

  const commit = (next: number, persist = false) => {
    preferred = clampSidebarPreferred(next)
    const w = clampSidebarWidth(preferred)
    setWidth(w)
    applySidebarWidthVar(w)
    if (persist) persistSidebarWidth(preferred)
  }

  const onHandlePointerDown = (e: PointerEvent) => {
    if (e.button !== 0) return
    e.preventDefault()
    dragOriginX = e.clientX
    dragOriginW = width()
    setDragging(true)
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }

  const onHandlePointerMove = (e: PointerEvent) => {
    if (!dragging()) return
    commit(dragOriginW + (e.clientX - dragOriginX))
  }

  const onHandlePointerUp = () => {
    if (!dragging()) return
    setDragging(false)
    persistSidebarWidth(width())
  }

  const onHandleDblClick = () => commit(SIDEBAR_WIDTH_DEFAULT, true)

  const onHandleKeyDown = (e: KeyboardEvent) => {
    const step = e.shiftKey ? 32 : 8
    if (e.key === 'ArrowLeft') { e.preventDefault(); commit(width() - step, true) }
    else if (e.key === 'ArrowRight') { e.preventDefault(); commit(width() + step, true) }
    else if (e.key === 'Home') { e.preventDefault(); commit(SIDEBAR_WIDTH_MIN, true) }
    else if (e.key === 'End') { e.preventDefault(); commit(sidebarWidthMax(), true) }
  }

  createEffect(() => {
    document.body.classList.toggle('docket-sidebar-resizing', dragging())
  })
  onMount(() => {
    const onResize = () => {
      const w = clampSidebarWidth(preferred)
      setWidth(w)
      applySidebarWidthVar(w)
    }
    window.addEventListener('resize', onResize)
    onCleanup(() => window.removeEventListener('resize', onResize))
  })
  onCleanup(() => document.body.classList.remove('docket-sidebar-resizing'))

  return (
    <aside class={styles.sidebar} style={{ width: `${width()}px` }}>
      <div
        class={`${styles.resizeHandle} ${dragging() ? styles.resizeHandleActive : ''}`}
        role="separator"
        aria-orientation="vertical"
        aria-label="调整侧栏宽度"
        aria-valuemin={SIDEBAR_WIDTH_MIN}
        aria-valuemax={sidebarWidthMax()}
        aria-valuenow={width()}
        aria-valuetext={`${width()} 像素`}
        tabindex="0"
        onPointerDown={onHandlePointerDown}
        onPointerMove={onHandlePointerMove}
        onPointerUp={onHandlePointerUp}
        onPointerCancel={onHandlePointerUp}
        onDblClick={onHandleDblClick}
        onKeyDown={onHandleKeyDown}
      />
      <div class={styles.scroll}>
        <div class={styles.section}>
          <p class={styles.sectionLabel}>视图</p>
          <nav class={styles.nav}>
            <For each={VIEWS}>
              {(v) => (
                <button
                  class={`${styles.item} ${isTrackActive(props.openFacet, props.activeView, v.key) ? styles.itemActive : ''}`}
                  onClick={() => props.onViewChange(v.key)}
                >
                  {v.label}
                </button>
              )}
            </For>
          </nav>
        </div>

        <div class={styles.divider} />

        <div class={styles.section}>
          <p class={styles.sectionLabel}>分类</p>
          <nav class={styles.nav}>
            <For each={props.categories}>
              {(c) => (
                <button
                  class={`${styles.item} ${isFacetActive(props.openFacet, 'category', c.id) ? styles.itemActive : ''}`}
                  title={c.name}
                  onClick={() => props.onFacetSelect({ type: 'category', id: c.id })}
                >
                  <span class={styles.dot} style={{ background: c.color ?? 'var(--accent)' }} />
                  <span class={styles.itemLabel}>{c.name}</span>
                </button>
              )}
            </For>
          </nav>
        </div>

        <div class={styles.divider} />

        <div class={styles.section}>
          <p class={styles.sectionLabel}>标签</p>
          <nav class={styles.nav}>
            <For each={props.tags}>
              {(t) => (
                <button
                  class={`${styles.item} ${isFacetActive(props.openFacet, 'tag', t.id) ? styles.itemActive : ''}`}
                  title={t.name}
                  onClick={() => props.onFacetSelect({ type: 'tag', id: t.id })}
                >
                  <span class={styles.dot} style={{ background: t.color ?? 'var(--text-label)' }} />
                  <span class={styles.itemLabel}>{t.name}</span>
                </button>
              )}
            </For>
          </nav>
        </div>
      </div>

      <div class={styles.bottom}>
        <button
          type="button"
          class={`${styles.gearBtn} ${props.settingsOpen ? styles.gearBtnActive : ''}`}
          onClick={props.onSettingsClick}
          title="设置"
          aria-label="设置"
        >
          <GearIcon />
        </button>
      </div>
    </aside>
  )
}

export default Sidebar
