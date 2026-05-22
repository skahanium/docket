import { type Component, For, Show, createEffect, createMemo, createResource, createSignal, onCleanup, onMount } from 'solid-js'
import { listen } from '@tauri-apps/api/event'
import { getCurrentWindow } from '@tauri-apps/api/window'
import styles from './DesktopPanel.module.css'
import {
  focusTaskFromPanel,
  getDesktopPanelSnapshot,
  getPanelSettings,
  type PanelSettings,
  type TaskPanelRow,
} from '../../bindings/panel'

const ROW_HEIGHT = 36
const VIRTUAL_THRESHOLD = 40
const OVERSCAN = 6

function daysOverdue(dueDate: string | null): number | null {
  if (!dueDate) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const due = new Date(`${dueDate}T00:00:00`)
  const diff = Math.floor((today.getTime() - due.getTime()) / 86_400_000)
  return diff > 0 ? diff : null
}

const DesktopPanel: Component = () => {
  const [visible, setVisible] = createSignal(false)
  const [settings, setSettings] = createSignal<PanelSettings>({
    panel_opaque: false,
    panel_always_on_top: false,
    panel_refresh_seconds: 120,
  })
  const [scrollTop, setScrollTop] = createSignal(0)
  let bodyRef: HTMLDivElement | undefined

  const [snapshot, { refetch }] = createResource(
    () => (visible() ? 'active' : undefined),
    async () => getDesktopPanelSnapshot(),
  )

  const refreshIfVisible = () => {
    if (visible()) void refetch()
  }

  onMount(async () => {
    try {
      const s = await getPanelSettings()
      setSettings(s)
    } catch {
      /* defaults */
    }

    const win = getCurrentWindow()
    setVisible(await win.isVisible())

    const unlistenTasks = listen('tasks-changed', refreshIfVisible)
    const unlistenVis = listen<boolean>('panel-visibility', (e) => {
      setVisible(e.payload)
      if (e.payload) {
        queueMicrotask(() => void refetch())
      }
    })
    const unlistenSettings = listen<PanelSettings>('panel-settings-changed', (e) => {
      setSettings(e.payload)
    })
    const unlistenFocus = win.onFocusChanged(({ payload: focused }) => {
      if (focused) refreshIfVisible()
    })

    onCleanup(() => {
      unlistenTasks.then((fn) => fn())
      unlistenVis.then((fn) => fn())
      unlistenSettings.then((fn) => fn())
      unlistenFocus.then((fn) => fn())
    })
  })

  createEffect(() => {
    if (!visible()) return
    const secs = settings().panel_refresh_seconds
    const id = window.setInterval(() => void refetch(), secs * 1000)
    onCleanup(() => window.clearInterval(id))
  })

  const openTask = (id: number) => {
    void focusTaskFromPanel(id)
  }

  const onHeaderPointerDown = (e: PointerEvent) => {
    if (e.button !== 0) return
    void getCurrentWindow().startDragging().catch(() => {})
  }

  const allItems = createMemo(() => [
    ...(snapshot()?.today ?? []).map((t) => ({ ...t, section: 'today' as const })),
    ...(snapshot()?.overdue ?? []).map((t) => ({ ...t, section: 'overdue' as const })),
  ])

  const virtualWindow = createMemo(() => {
    const items = allItems()
    const el = bodyRef
    const vh = el?.clientHeight ?? 400
    if (items.length < VIRTUAL_THRESHOLD) {
      return { padTop: 0, padBottom: 0, visible: items }
    }
    const start = Math.max(0, Math.floor(scrollTop() / ROW_HEIGHT) - OVERSCAN)
    const count = Math.ceil(vh / ROW_HEIGHT) + OVERSCAN * 2
    const end = Math.min(items.length, start + count)
    return {
      padTop: start * ROW_HEIGHT,
      padBottom: Math.max(0, (items.length - end) * ROW_HEIGHT),
      visible: items.slice(start, end),
    }
  })

  const renderRow = (task: TaskPanelRow & { section: 'today' | 'overdue' }) => {
    const overdueDays = task.section === 'overdue' ? daysOverdue(task.due_date) : null
    return (
      <button
        type="button"
        class={styles.item}
        onClick={() => openTask(task.id)}
        aria-label={`${task.title}${overdueDays ? `，逾期 ${overdueDays} 天` : ''}`}
      >
        <span
          class={styles.priority}
          classList={{
            [styles.priorityHigh]: task.priority >= 2,
            [styles.priorityMed]: task.priority === 1,
          }}
          aria-hidden
        />
        <span class={styles.itemTitle}>{task.title}</span>
        <Show when={overdueDays != null}>
          <span class={styles.overdueBadge}>{overdueDays}天</span>
        </Show>
      </button>
    )
  }

  const renderList = (items: TaskPanelRow[] | undefined, section: 'today' | 'overdue') => (
    <Show
      when={items && items.length > 0}
      fallback={<p class={styles.empty}>无</p>}
    >
      <For each={items!}>{(task) => renderRow({ ...task, section })}</For>
    </Show>
  )

  return (
    <div
      class={styles.shell}
      classList={{ [styles.shellOpaque]: settings().panel_opaque }}
    >
      <header
        class={styles.header}
        data-tauri-drag-region
        onPointerDown={onHeaderPointerDown}
      >
        <span class={styles.title}>今日任务</span>
        <span class={styles.dragHint} aria-hidden="true">
          ⋮⋮
        </span>
      </header>
      <div
        class={styles.body}
        ref={bodyRef}
        onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
      >
        <Show
          when={!snapshot.loading}
          fallback={<p class={styles.loading}>加载中…</p>}
        >
          <Show
            when={!snapshot.error}
            fallback={
              <div class={styles.errorBox}>
                <p class={styles.errorText}>加载失败</p>
                <button type="button" class={styles.retryBtn} onClick={() => void refetch()}>
                  重试
                </button>
              </div>
            }
          >
            <Show
              when={
                (snapshot()?.today.length ?? 0) + (snapshot()?.overdue.length ?? 0) <
                VIRTUAL_THRESHOLD
              }
              fallback={
                <>
                  <p class={styles.sectionLabel}>
                    今日 ({snapshot()?.today.length ?? 0}) · 逾期 (
                    {snapshot()?.overdue.length ?? 0})
                  </p>
                  <div style={{ height: `${virtualWindow().padTop}px` }} />
                  <For each={virtualWindow().visible}>{(task) => renderRow(task)}</For>
                  <div style={{ height: `${virtualWindow().padBottom}px` }} />
                </>
              }
            >
              <p class={styles.sectionLabel}>今日 ({snapshot()?.today.length ?? 0})</p>
              {renderList(snapshot()?.today, 'today')}
              <p class={styles.sectionLabel}>逾期 ({snapshot()?.overdue.length ?? 0})</p>
              {renderList(snapshot()?.overdue, 'overdue')}
            </Show>
          </Show>
        </Show>
      </div>
    </div>
  )
}

export default DesktopPanel
