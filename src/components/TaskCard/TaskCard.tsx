import { type Component } from 'solid-js'
import styles from './TaskCard.module.css'
import Checkbox from '../shared/Checkbox'
import type { TaskSummary } from '../../bindings/types'

interface Props {
  task: TaskSummary
  showCheckbox?: boolean
  draggable?: boolean
  onToggle: (id: number) => void
  onClick: (id: number) => void
  onDragStart?: (id: number, e: DragEvent) => void
}

const TaskCard: Component<Props> = (props) => {
  const t = props.task
  const completed = t.status === 'completed'
  const hasProgress = t.subtasks_progress.total > 0
  const pct = hasProgress ? Math.round((t.subtasks_progress.completed / t.subtasks_progress.total) * 100) : 0
  const overdue = !completed && !!t.due_date && t.due_date < new Date().toISOString().slice(0, 10)
  const showChk = props.showCheckbox !== false

  const handleDragStart = (e: DragEvent) => {
    e.dataTransfer?.setData('text/plain', String(t.id))
    if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move'
    props.onDragStart?.(t.id, e)
  }

  return (
    <div
      class={`${styles.card} ${overdue ? styles.cardOverdue : ''}`}
      role="button"
      tabindex={0}
      draggable={props.draggable ?? false}
      onDragStart={props.draggable ? handleDragStart : undefined}
      onClick={() => props.onClick(t.id)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); props.onClick(t.id) } }}
      aria-label={`${t.title}${overdue ? '，已逾期' : ''}${completed ? '，已完成' : ''}`}
    >
      {showChk && (
        <Checkbox checked={completed} onClick={(e) => { e.stopPropagation(); props.onToggle(t.id) }} />
      )}

      <div class={styles.body}>
        <div class={styles.titleRow}>
          <span class={`${styles.title} ${completed ? styles.titleCompleted : ''}`}>{t.title}</span>
          <span class={`${styles.priority} ${t.priority === 1 ? styles.priorityMed : ''} ${t.priority === 2 ? styles.priorityHigh : ''}`}>{t.priority === 1 ? '●' : t.priority === 2 ? '●●' : ''}</span>
        </div>

        {(t.due_date || t.tags.length > 0 || hasProgress) && (
          <div class={styles.metaRow}>
            {t.due_date && <span class={`${styles.dueDate} ${overdue ? styles.dueDateOverdue : ''}`}>{t.due_date}</span>}
            {t.tags.map((tag) => (
              <span class={styles.tag} style={{ background: `${tag.color ?? '#737373'}16`, color: tag.color ?? 'var(--text-sub)' }}>{tag.name}</span>
            ))}
            {hasProgress && <span class={styles.subCount}>{t.subtasks_progress.completed}/{t.subtasks_progress.total}</span>}
          </div>
        )}

        {hasProgress && (
          <div class={styles.progressBar}>
            <div class={`${styles.progressFill} ${pct === 100 ? styles.progressFillDone : ''}`} style={{ width: `${pct}%` }} />
          </div>
        )}
      </div>
    </div>
  )
}

export default TaskCard
