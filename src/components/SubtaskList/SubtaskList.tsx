import { type Component, For, createSignal } from 'solid-js'
import styles from './SubtaskList.module.css'
import type { Subtask } from '../../bindings/types'
import {
  updateSubtask,
  deleteSubtask,
  addSubtask,
  reorderSubtasks,
  invalidateAfterTaskMutation,
  pushToast,
} from '../../stores'

interface Props {
  taskId: number
  subtasks: Subtask[]
}

const SubtaskList: Component<Props> = (props) => {
  const [newTitle, setNewTitle] = createSignal('')
  const [dragIdx, setDragIdx] = createSignal<number | null>(null)
  const [overIdx, setOverIdx] = createSignal<number | null>(null)

  const toggle = async (sub: Subtask) => {
    try { await updateSubtask(sub.id, undefined, sub.status === 'completed' ? 'pending' : 'completed'); invalidateAfterTaskMutation() }
    catch (e) { pushToast('error', `更新失败: ${e}`) }
  }

  const add = async () => {
    const t = newTitle().trim(); if (!t) return
    try { await addSubtask(props.taskId, t); setNewTitle(''); invalidateAfterTaskMutation() }
    catch (e) { pushToast('error', `添加失败: ${e}`) }
  }

  const remove = async (id: number) => {
    try { await deleteSubtask(id); invalidateAfterTaskMutation() }
    catch (e) { pushToast('error', `删除失败: ${e}`) }
  }

  const handleDragStart = (idx: number) => { setDragIdx(idx) }
  const handleDragOver = (e: DragEvent, idx: number) => { e.preventDefault(); setOverIdx(idx) }
  const handleDragLeave = () => { setOverIdx(null) }
  const handleDrop = async (targetIdx: number) => {
    const from = dragIdx()
    if (from === null || from === targetIdx) { setDragIdx(null); setOverIdx(null); return }
    const items = [...props.subtasks]
    const [moved] = items.splice(from, 1)
    items.splice(targetIdx, 0, moved)
    const orderedIds = items.map(s => s.id)
    setDragIdx(null); setOverIdx(null)
    try { await reorderSubtasks(props.taskId, orderedIds); invalidateAfterTaskMutation() }
    catch (e) { pushToast('error', `排序失败: ${e}`) }
  }
  const handleDragEnd = () => { setDragIdx(null); setOverIdx(null) }

  return (
    <div class={styles.wrap}>
      <p class={styles.sectionLabel}>子任务 ({props.subtasks.length})</p>

      <div class={styles.list}>
        <For each={props.subtasks}>
          {(sub, idx) => {
            const done = sub.status === 'completed'
            return (
              <div
                class={`${styles.item} ${dragIdx() === idx() ? styles.itemDragging : ''} ${overIdx() === idx() ? styles.itemDragOver : ''}`}
                draggable={true}
                onDragStart={() => handleDragStart(idx())}
                onDragOver={(e) => handleDragOver(e, idx())}
                onDragLeave={handleDragLeave}
                onDrop={() => handleDrop(idx())}
                onDragEnd={handleDragEnd}
              >
                <span class={styles.dragHandle} title="拖拽排序">⠿</span>
                <button class={`${styles.check} ${done ? styles.checkDone : ''}`} onClick={() => toggle(sub)}>
                  {done && (
                    <svg class={styles.checkIcon} viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M2 6l3 3L10 3" />
                    </svg>
                  )}
                </button>
                <span class={`${styles.itemTitle} ${done ? styles.itemTitleDone : ''}`}>{sub.title}</span>
                <button class={styles.removeBtn} onClick={() => remove(sub.id)}>✕</button>
              </div>
            )
          }}
        </For>
      </div>

      <div class={styles.addRow}>
        <input type="text" class={styles.addInput} value={newTitle()} onInput={(e) => setNewTitle(e.currentTarget.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') add() }} placeholder="添加子任务…" />
        <button class={styles.addBtn} disabled={!newTitle().trim()} onClick={add}>添加</button>
      </div>
    </div>
  )
}

export default SubtaskList
