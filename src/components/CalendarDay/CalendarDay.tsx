import { type Component, Show, For, createSignal } from 'solid-js'
import styles from './CalendarDay.module.css'
import type { CalendarDayData } from '../../bindings/types'

interface Props {
  data: CalendarDayData
  isToday: boolean
  isSelected: boolean
  onSelect: () => void
  onDoubleClick: () => void
  onDrop?: (taskId: number) => void
}

const CalendarDay: Component<Props> = (props) => {
  const dayNum = parseInt(props.data.date.split('-')[2], 10)
  const allDone = props.data.task_count > 0 && props.data.task_count === props.data.completed_count
  const hasPending = props.data.task_count > props.data.completed_count
  const [dragOver, setDragOver] = createSignal(false)

  const pendingDots = Math.min(Math.max(0, props.data.task_count - props.data.completed_count), 3)
  const doneDots = Math.min(props.data.completed_count, 3)
  const overflow = props.data.task_count > 3 ? `+${props.data.task_count - 3}` : null
  const hasTasks = props.data.task_count > 0
  const donePct = hasTasks ? Math.round((props.data.completed_count / props.data.task_count) * 100) : 0

  const handleDrop = (e: DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const taskId = parseInt(e.dataTransfer?.getData('text/plain') ?? '', 10)
    if (taskId > 0) props.onDrop?.(taskId)
  }

  const cellClass = () => {
    const cls = [styles.cell]
    if (props.isSelected) cls.push(styles.selected)
    if (dragOver()) cls.push(styles.dragOver)
    return cls.join(' ')
  }

  return (
    <div
      class={cellClass()}
      role="gridcell"
      tabindex={0}
      aria-label={`${dayNum}日，${props.data.task_count}项任务${hasPending ? `，${props.data.task_count - props.data.completed_count}项待完成` : ''}`}
      onClick={props.onSelect}
      onDblClick={props.onDoubleClick}
      onKeyDown={(e) => { if (e.key === 'Enter') props.onSelect() }}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
    >
      <div class={props.isToday ? styles.today : ''}>
        <div class={styles.dateWrap}>
          <span class={styles.dateNum}>{dayNum}</span>
        </div>
      </div>

      <Show when={hasTasks}>
        <Show when={allDone} fallback={
          <Show when={props.data.completed_count > 0} fallback={
            <div class={styles.taskBar + ' ' + styles.taskBarPending} />
          }>
            <div class={styles.taskBar + ' ' + styles.taskBarMix} style={{ '--done-pct': `${donePct}%` }} />
          </Show>
        }>
          <div class={styles.taskBar + ' ' + styles.taskBarDone} />
        </Show>

        <div class={styles.dots}>
          <Show when={hasPending}>
            <For each={Array.from({ length: pendingDots })}>{() => <span class={`${styles.dot} ${styles.dotPending}`} />}</For>
          </Show>
          <Show when={allDone || props.data.completed_count > 0}>
            <For each={Array.from({ length: Math.min(doneDots, 3 - pendingDots) })}>{() => <span class={`${styles.dot} ${styles.dotDone}`} />}</For>
          </Show>
          {overflow && <span class={styles.overflow}>{overflow}</span>}
        </div>
      </Show>
    </div>
  )
}

export default CalendarDay