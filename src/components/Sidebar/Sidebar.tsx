import { type Component, For } from 'solid-js'
import styles from './Sidebar.module.css'
import type { ViewKind } from '../../stores'
import type { Category, Tag } from '../../bindings/types'

interface Props {
  activeView: ViewKind
  categories: Category[]
  tags: Tag[]
  activeCategoryId: number | null
  activeTagId: number | null
  settingsOpen?: boolean
  onViewChange: (v: ViewKind) => void
  onCategorySelect: (id: number | null) => void
  onTagSelect: (id: number | null) => void
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
  return (
    <aside class={styles.sidebar}>
      <div class={styles.scroll}>
        <div class={styles.section}>
          <p class={styles.sectionLabel}>视图</p>
          <nav class={styles.nav}>
            <For each={VIEWS}>
              {(v) => (
                <button
                  class={`${styles.item} ${props.activeView === v.key ? styles.itemActive : ''}`}
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
                  class={`${styles.item} ${props.activeCategoryId === c.id ? styles.itemActive : ''}`}
                  onClick={() => props.onCategorySelect(props.activeCategoryId === c.id ? null : c.id)}
                >
                  <span class={styles.dot} style={{ background: c.color ?? 'var(--accent)' }} />
                  {c.name}
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
                  class={`${styles.item} ${props.activeTagId === t.id ? styles.itemActive : ''}`}
                  onClick={() => props.onTagSelect(props.activeTagId === t.id ? null : t.id)}
                >
                  <span class={styles.dot} style={{ background: t.color ?? 'var(--text-label)' }} />
                  {t.name}
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
