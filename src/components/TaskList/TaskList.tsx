import { type Component, For, Show, createResource, createSignal, createMemo, onMount, onCleanup } from 'solid-js'
import styles from './TaskList.module.css'
import TaskCard from '../TaskCard/TaskCard'
import type { TaskSummary, Category, Tag } from '../../bindings/types'
import {
  activePriority, setActivePriority, activeCategoryId, setActiveCategoryId,
  activeTagId, setActiveTagId, clearFilters,
  sortField, setSortField, sortDir, setSortDir, selectedDate,
  type SortField, type SortDir,
  getWorkloadSummary,
} from '../../stores'

interface Props {
  title: string
  tasks: TaskSummary[]
  loading: boolean
  error: string | null
  categories: Category[]
  tags: Tag[]
  showFilters: boolean
  isArchive?: boolean
  onCategoryChange: (id: number | null) => void
  onTagChange: (id: number | null) => void
  onClearFilters: () => void
  onTaskToggle: (id: number) => void
  onTaskClick: (id: number) => void
  onRetry: () => void
}

const ROW_HEIGHT = 68
const VIRTUAL_THRESHOLD = 40
const OVERSCAN = 4

const TaskList: Component<Props> = (props) => {
  let listRef: HTMLDivElement | undefined
  const [scrollTop, setScrollTop] = createSignal(0)
  const [viewportH, setViewportH] = createSignal(480)

  onMount(() => {
    const el = listRef
    if (!el) return
    const ro = new ResizeObserver(() => setViewportH(el.clientHeight))
    ro.observe(el)
    onCleanup(() => ro.disconnect())
  })

  const virtualWindow = createMemo(() => {
    const items = props.tasks
    if (items.length < VIRTUAL_THRESHOLD) {
      return { start: 0, end: items.length, padTop: 0, padBottom: 0, visible: items }
    }
    const start = Math.max(0, Math.floor(scrollTop() / ROW_HEIGHT) - OVERSCAN)
    const count = Math.ceil(viewportH() / ROW_HEIGHT) + OVERSCAN * 2
    const end = Math.min(items.length, start + count)
    return {
      start,
      end,
      padTop: start * ROW_HEIGHT,
      padBottom: Math.max(0, (items.length - end) * ROW_HEIGHT),
      visible: items.slice(start, end),
    }
  })

  const [workload] = createResource(
    () => props.showFilters && !props.isArchive && !props.error,
    async (active) => {
      if (!active) return null
      try { return await getWorkloadSummary() } catch { return null }
    },
  )

  const formatMins = (m: number) => {
    if (m >= 60) { const h = Math.floor(m / 60); const min = m % 60; return min > 0 ? `${h}h${min}m` : `${h}h` }
    return `${m}m`
  }

  const gaugePct = () => {
    const w = workload()
    if (!w || w.available_minutes === 0) return 0
    return Math.min(100, Math.round((w.estimated_total_minutes / w.available_minutes) * 100))
  }

  const gaugeColor = () => {
    const w = workload()
    if (!w || w.available_minutes === 0) return 'var(--accent)'
    const r = w.estimated_total_minutes / w.available_minutes
    if (r > 1) return 'var(--danger)'
    if (r > 0.8) return 'var(--warning)'
    return 'var(--success)'
  }

  return (
    <div class={styles.container}>
      <div class={styles.header}>
        <h2 class={styles.title}>
          {props.title}
          {selectedDate() && <span class={styles.dateHint}>· {selectedDate()}</span>}
        </h2>
        <div style={{ display: 'flex', gap: '4px' }}>
          <select class={styles.sortSelect} value={sortField()} onChange={(e) => setSortField(e.currentTarget.value as SortField)}>
            <option value="due_date">截止日</option>
            <option value="created_at">创建时间</option>
            <option value="priority">优先级</option>
            <option value="title">标题</option>
          </select>
          <select class={styles.sortSelect} value={sortDir()} onChange={(e) => setSortDir(e.currentTarget.value as SortDir)}>
            <option value="asc">升序</option>
            <option value="desc">降序</option>
          </select>
        </div>
      </div>

      <Show when={workload() && workload()!.available_minutes > 0}>
        <div class={styles.gaugeRow}>
          <span class={styles.gaugeLabel}>{formatMins(workload()!.actual_focus_minutes)} 专注</span>
          <div class={styles.gauge} title={`预估 ${formatMins(workload()!.estimated_total_minutes)} / 可用 ${formatMins(workload()!.available_minutes)}`}>
            <div class={styles.gaugeFill} style={{ width: `${gaugePct()}%`, background: gaugeColor() }} />
          </div>
          <span class={styles.gaugeLabel}>{workload()!.completed_count}/{workload()!.task_count} 完成</span>
          <div class={styles.gaugeDivider} />
          <span class={styles.gaugeLabel}>预估 {formatMins(workload()!.estimated_total_minutes)} / 可用 {formatMins(workload()!.available_minutes)}</span>
        </div>
      </Show>

      {props.showFilters && (
        <div class={styles.filterRow}>
          <select class={styles.filterSelect} value={activeCategoryId() ?? ''} onChange={(e) => setActiveCategoryId(e.currentTarget.value ? Number(e.currentTarget.value) : null)}>
            <option value="">分类</option>
            <For each={props.categories}>{(c) => <option value={c.id}>{c.name}</option>}</For>
          </select>
          <select class={styles.filterSelect} value={activeTagId() ?? ''} onChange={(e) => setActiveTagId(e.currentTarget.value ? Number(e.currentTarget.value) : null)}>
            <option value="">标签</option>
            <For each={props.tags}>{(t) => <option value={t.id}>{t.name}</option>}</For>
          </select>
          <select class={styles.filterSelect} value={activePriority() ?? ''} onChange={(e) => setActivePriority(e.currentTarget.value ? Number(e.currentTarget.value) : null)}>
            <option value="">优先级</option>
            <option value="0">○ 低</option>
            <option value="1">● 中</option>
            <option value="2">●● 高</option>
          </select>
          {(activeCategoryId() || activeTagId() || activePriority()) && (
            <button class={styles.clearFilter} onClick={clearFilters}>清除筛选</button>
          )}
        </div>
      )}

      <Show when={props.error}>
        <div class={styles.error}><p class={styles.errorText}>加载失败</p><button class={styles.retryBtn} onClick={props.onRetry}>重试</button></div>
      </Show>

      <Show when={props.loading && !props.error}>
        <div class={styles.list}>
          {[0, 1, 2].map(() => (
            <div class={styles.skeletonCard}>
              <div class={`${styles.skeletonCircle} skeleton`} />
              <div class={styles.skeletonLines}><div class={`${styles.skeletonLine} skeleton`} /><div class={`${styles.skeletonLine} skeleton`} /></div>
            </div>
          ))}
        </div>
      </Show>

      <Show when={!props.loading && !props.error && props.tasks.length === 0}>
        <div class={styles.empty}>
          <div class={styles.emptyIcon}>
            <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
              <path d="M8 3.5V8l2.5 2M8 14A6 6 0 108 2a6 6 0 000 12z" />
            </svg>
          </div>
          <p class={styles.emptyTitle}>暂无任务</p>
          <p class={styles.emptyHint}>点击顶部 + 新建 开始规划</p>
        </div>
      </Show>

      <Show when={!props.loading && !props.error && props.tasks.length > 0}>
        <div
          ref={listRef}
          class={props.tasks.length >= VIRTUAL_THRESHOLD ? styles.listVirtual : styles.list}
          onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
        >
          <Show when={props.tasks.length >= VIRTUAL_THRESHOLD}>
            <div style={{ height: `${virtualWindow().padTop}px` }} />
          </Show>
          <For each={virtualWindow().visible}>
            {(task) => (
              <div class={styles.taskRow}>
                <TaskCard task={task} showCheckbox={!props.isArchive} draggable={!props.isArchive}
                  onToggle={props.onTaskToggle} onClick={props.onTaskClick}
                />
              </div>
            )}
          </For>
          <Show when={props.tasks.length >= VIRTUAL_THRESHOLD}>
            <div style={{ height: `${virtualWindow().padBottom}px` }} />
          </Show>
        </div>
      </Show>
    </div>
  )
}

export default TaskList