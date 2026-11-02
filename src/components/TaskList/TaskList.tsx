import { type Component, For, Show, createResource, createSignal, createMemo, onMount, onCleanup } from 'solid-js'
import styles from './TaskList.module.css'
import TaskCard from '../TaskCard/TaskCard'
import type { TaskSummary } from '../../bindings/types'
import {
  activePriority, setActivePriority,
  sortField, setSortField, sortDir, setSortDir,
  type SortField, type SortDir,
  getWorkloadSummary,
  listArchived,
  taskMutationEpoch,
} from '../../stores'

interface Props {
  title: string
  tasks: TaskSummary[]
  loading: boolean
  error: string | null
  compact?: boolean
  onTaskToggle: (id: number) => void
  onTaskClick: (id: number) => void
  onRetry: () => void
}

const ROW_HEIGHT = 68
const VIRTUAL_THRESHOLD = 40
const OVERSCAN = 4

function compareTasks(a: TaskSummary, b: TaskSummary, field: SortField, dir: SortDir): number {
  const mul = dir === 'asc' ? 1 : -1
  switch (field) {
    case 'title':
      return mul * a.title.localeCompare(b.title, 'zh')
    case 'priority':
      return mul * (a.priority - b.priority)
    case 'created_at':
      return mul * a.created_at.localeCompare(b.created_at)
    case 'due_date': {
      const da = a.due_date ?? ''
      const db = b.due_date ?? ''
      if (!da && !db) return 0
      if (!da) return 1
      if (!db) return -1
      return mul * da.localeCompare(db)
    }
  }
}

const TaskList: Component<Props> = (props) => {
  let listRef: HTMLDivElement | undefined
  const [scrollTop, setScrollTop] = createSignal(0)
  const [viewportH, setViewportH] = createSignal(480)
  const [showArchived, setShowArchived] = createSignal(false)

  onMount(() => {
    const el = listRef
    if (!el) return
    const ro = new ResizeObserver(() => setViewportH(el.clientHeight))
    ro.observe(el)
    onCleanup(() => ro.disconnect())
  })

  const [archived, { refetch: refetchArchived }] = createResource(
    () => (showArchived() && !props.compact ? ([taskMutationEpoch()] as const) : null),
    () => listArchived(),
  )

  const rows = createMemo(() => {
    if (showArchived() && !props.compact) {
      let list = archived() ?? []
      const priority = activePriority()
      if (priority != null) list = list.filter((t) => t.priority === priority)
      return [...list].sort((a, b) => compareTasks(a, b, sortField(), sortDir()))
    }
    return props.tasks
  })

  const loading = () => showArchived() && !props.compact ? archived.loading : props.loading
  const error = () => showArchived() && !props.compact ? (archived.error ? String(archived.error) : null) : props.error
  const isArchive = () => showArchived() && !props.compact

  const virtualWindow = createMemo(() => {
    const items = rows()
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
    () => !props.compact && !showArchived() && !props.error,
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

  const retry = () => {
    if (isArchive()) void refetchArchived()
    else props.onRetry()
  }

  return (
    <div class={`${styles.container} ${props.compact ? styles.compact : ''}`}>
      <div class={styles.header}>
        <div class={styles.headerMain}>
          <h2 class={styles.title}>{props.title}</h2>
          <Show when={!props.compact}>
            <label class={styles.archiveToggle}>
              <input
                type="checkbox"
                checked={showArchived()}
                onChange={(e) => setShowArchived(e.currentTarget.checked)}
              />
              看归档
            </label>
          </Show>
        </div>
        <Show when={!props.compact}>
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
        </Show>
      </div>

      <Show when={!props.compact && !isArchive() && workload() && workload()!.available_minutes > 0}>
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

      <Show when={!props.compact}>
        <div class={styles.filterRow}>
          <select class={styles.filterSelect} value={activePriority() ?? ''} onChange={(e) => setActivePriority(e.currentTarget.value ? Number(e.currentTarget.value) : null)}>
            <option value="">优先级</option>
            <option value="0">○ 低</option>
            <option value="1">● 中</option>
            <option value="2">●● 高</option>
          </select>
          <Show when={activePriority() != null}>
            <button class={styles.clearFilter} onClick={() => setActivePriority(null)}>清除筛选</button>
          </Show>
        </div>
      </Show>

      <Show when={error()}>
        <div class={styles.error}><p class={styles.errorText}>加载失败</p><button class={styles.retryBtn} onClick={retry}>重试</button></div>
      </Show>

      <Show when={loading() && !error()}>
        <div class={styles.list}>
          {[0, 1, 2].map(() => (
            <div class={styles.skeletonCard}>
              <div class={`${styles.skeletonCircle} skeleton`} />
              <div class={styles.skeletonLines}><div class={`${styles.skeletonLine} skeleton`} /><div class={`${styles.skeletonLine} skeleton`} /></div>
            </div>
          ))}
        </div>
      </Show>

      <Show when={!loading() && !error() && rows().length === 0}>
        <div class={styles.empty}>
          <div class={styles.emptyIcon}>
            <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
              <path d="M8 3.5V8l2.5 2M8 14A6 6 0 108 2a6 6 0 000 12z" />
            </svg>
          </div>
          <p class={styles.emptyTitle}>{isArchive() ? '没有已归档任务' : '暂无任务'}</p>
          <p class={styles.emptyHint}>{isArchive() ? '归档的任务会出现在这里' : '点击顶部 + 新建 开始规划'}</p>
        </div>
      </Show>

      <Show when={!loading() && !error() && rows().length > 0}>
        <div
          ref={listRef}
          class={rows().length >= VIRTUAL_THRESHOLD ? styles.listVirtual : styles.list}
          onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
        >
          <Show when={rows().length >= VIRTUAL_THRESHOLD}>
            <div style={{ height: `${virtualWindow().padTop}px` }} />
          </Show>
          <For each={virtualWindow().visible}>
            {(task) => (
              <div class={styles.taskRow}>
                <TaskCard task={task} showCheckbox={!isArchive()} draggable={!isArchive()}
                  onToggle={props.onTaskToggle} onClick={props.onTaskClick}
                />
              </div>
            )}
          </For>
          <Show when={rows().length >= VIRTUAL_THRESHOLD}>
            <div style={{ height: `${virtualWindow().padBottom}px` }} />
          </Show>
        </div>
      </Show>
    </div>
  )
}

export default TaskList
