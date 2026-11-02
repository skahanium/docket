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
  onViewChange: (v: ViewKind) => void
  onCategorySelect: (id: number | null) => void
  onTagSelect: (id: number | null) => void
}

const VIEWS: { key: ViewKind; label: string }[] = [
  { key: 'today', label: '今日' },
  { key: 'tasks', label: '任务' },
  { key: 'matters', label: '事项' },
  { key: 'calendar', label: '日历' },
  { key: 'progress', label: '进展' },
]

const Sidebar: Component<Props> = (props) => {
  return (
    <aside class={styles.sidebar}>
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
    </aside>
  )
}

export default Sidebar
