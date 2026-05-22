import { type Component, For, Show, createSignal } from 'solid-js'
import styles from './Sidebar.module.css'
import type { ViewKind } from '../../stores'
import type { Category, Tag } from '../../bindings/types'
import CategoryManager from '../CategoryManager/CategoryManager'
import TagManager from '../TagManager/TagManager'

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
  { key: 'all', label: '全部' },
  { key: 'today', label: '今日' },
  { key: 'schedule', label: '日程' },
  { key: 'calendar', label: '日历' },
]

const Sidebar: Component<Props> = (props) => {
  const [managingCategories, setManagingCategories] = createSignal(false)
  const [managingTags, setManagingTags] = createSignal(false)

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
        <div class={styles.sectionHeader}>
          <p class={styles.sectionLabel}>分类</p>
          <button class={styles.manageBtn} onClick={() => setManagingCategories(v => !v)}>
            {managingCategories() ? '完成' : '管理'}
          </button>
        </div>
        <Show when={!managingCategories()} fallback={<CategoryManager />}>
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
        </Show>
      </div>

      <div class={styles.divider} />

      <div class={styles.section}>
        <div class={styles.sectionHeader}>
          <p class={styles.sectionLabel}>标签</p>
          <button class={styles.manageBtn} onClick={() => setManagingTags(v => !v)}>
            {managingTags() ? '完成' : '管理'}
          </button>
        </div>
        <Show when={!managingTags()} fallback={<TagManager />}>
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
        </Show>
      </div>

      <div class={styles.bottom}>
        <div class={styles.divider} />
        <nav class={styles.nav} style={{ 'margin-top': '8px' }}>
          {([
            { key: 'stats' as ViewKind, label: '统计' },
            { key: 'archive' as ViewKind, label: '归档' },
            { key: 'settings' as ViewKind, label: '设置' },
          ]).map((v) => (
            <button
              class={`${styles.item} ${props.activeView === v.key ? styles.itemActive : ''}`}
              onClick={() => props.onViewChange(v.key)}
            >
              {v.label}
            </button>
          ))}
        </nav>
      </div>
    </aside>
  )
}

export default Sidebar
