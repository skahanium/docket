import { type Component, For, Show, createResource, onMount, onCleanup } from 'solid-js'
import { listen } from '@tauri-apps/api/event'
import { getCurrentWindow } from '@tauri-apps/api/window'
import styles from './DesktopPanel.module.css'
import { getDesktopPanelSnapshot, focusTaskFromPanel } from '../../bindings/panel'
import type { TaskSummary } from '../../bindings/types'

const DesktopPanel: Component = () => {
  const [snapshot, { refetch }] = createResource(getDesktopPanelSnapshot)

  onMount(() => {
    const unlistenTasks = listen('tasks-changed', () => {
      void refetch()
    })
    const win = getCurrentWindow()
    const unlistenFocus = win.onFocusChanged(({ payload: focused }) => {
      if (focused) void refetch()
    })
    onCleanup(() => {
      unlistenTasks.then((fn) => fn())
      unlistenFocus.then((fn) => fn())
    })
  })

  const onDrag = () => {
    void getCurrentWindow().startDragging()
  }

  const openTask = (id: number) => {
    void focusTaskFromPanel(id)
  }

  const renderList = (items: TaskSummary[] | undefined) => (
    <Show
      when={items && items.length > 0}
      fallback={<p class={styles.empty}>无</p>}
    >
      <For each={items!}>
        {(task) => (
          <button type="button" class={styles.item} onClick={() => openTask(task.id)}>
            <span class={styles.itemTitle}>{task.title}</span>
          </button>
        )}
      </For>
    </Show>
  )

  return (
    <div class={styles.shell} data-tauri-drag-region>
      <header class={styles.header} onMouseDown={onDrag}>
        <span class={styles.title}>今日任务</span>
      </header>
      <div class={styles.body}>
        <Show when={!snapshot.loading} fallback={<p class={styles.loading}>加载中…</p>}>
          <p class={styles.sectionLabel}>今日 ({snapshot()?.today.length ?? 0})</p>
          {renderList(snapshot()?.today)}
          <p class={styles.sectionLabel}>逾期 ({snapshot()?.overdue.length ?? 0})</p>
          {renderList(snapshot()?.overdue)}
        </Show>
      </div>
    </div>
  )
}

export default DesktopPanel
