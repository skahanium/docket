import { type Component, createResource, Show, For } from 'solid-js'
import styles from './DailyReview.module.css'
import { getDailyReview } from '../../stores'

interface Props {
  open: boolean
  date?: string
  onClose: () => void
}

function formatMins(m: number): string {
  if (m >= 60) { const h = Math.floor(m / 60); const min = m % 60; return min > 0 ? `${h}h ${min}m` : `${h}h` }
  return `${m}m`
}

function accuracyColor(v: number): string {
  if (v >= 0.9) return 'var(--success)'
  if (v >= 0.6) return 'var(--warning)'
  return 'var(--danger)'
}

const DailyReviewDialog: Component<Props> = (props) => {
  const [data] = createResource(
    () => props.open && (props.date || true),
    async (active) => {
      if (!active) return null
      try { return await getDailyReview(props.date) } catch { return null }
    },
  )

  if (!props.open) return null

  return (
    <div class={styles.overlay} onClick={props.onClose}>
      <div class={styles.dialog} onClick={(e) => e.stopPropagation()}>
        <div class={styles.header}>
          <div>
            <h2 class={styles.title}>今日复盘</h2>
            <Show when={data()}>
              <p class={styles.dateSub}>{data()!.date}</p>
            </Show>
          </div>
          <button class={styles.closeBtn} onClick={props.onClose}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 4l8 8M12 4l-8 8" /></svg>
          </button>
        </div>

        <Show when={!data() && !data.loading}>
          <p class={styles.emptyHint}>无法加载复盘数据</p>
        </Show>

        <Show when={data.loading}>
          <p class={styles.emptyHint}>加载中…</p>
        </Show>

        <Show when={data() && !data()!.is_workday}>
          <div class={styles.summaryCards} style={{ 'grid-template-columns': '1fr' }}>
            <div class={styles.summaryCard}>
              <p class={`${styles.summaryValue} ${styles.summaryWarning}`}>休息日</p>
              <p class={styles.summaryLabel}>今天是节假日或周末，无需复盘</p>
            </div>
          </div>
          <div class={styles.footer}>
            <button class={styles.doneBtn} onClick={props.onClose}>关闭</button>
          </div>
        </Show>

        <Show when={data() && data()!.is_workday}>
          {/* Summary cards */}
          <div class={styles.summaryCards}>
            <div class={styles.summaryCard}>
              <p class={`${styles.summaryValue} ${styles.summaryAccent}`}>{formatMins(data()!.total_focus_minutes)}</p>
              <p class={styles.summaryLabel}>专注时长</p>
            </div>
            <div class={styles.summaryCard}>
              <p class={`${styles.summaryValue} ${styles.summarySuccess}`}>{data()!.completed_tasks.length}</p>
              <p class={styles.summaryLabel}>完成 {data()!.completed_tasks.length + data()!.incomplete_tasks.length} 项</p>
            </div>
            <div class={styles.summaryCard}>
              <p class={styles.summaryValue} style={{ color: accuracyColor(data()!.plan_accuracy) }}>
                {Math.round(data()!.plan_accuracy * 100)}%
              </p>
              <p class={styles.summaryLabel}>预估准确度</p>
            </div>
          </div>

          {/* Completed tasks */}
          <Show when={data()!.completed_tasks.length > 0}>
            <div class={styles.section}>
              <p class={styles.sectionLabel}>
                已完成
                <span class={styles.sectionCount}>{data()!.completed_tasks.length}</span>
              </p>
              <For each={data()!.completed_tasks}>
                {(task) => {
                  const est = task.estimated_minutes
                  const act = task.actual_focus_minutes
                  const over = est && act > est
                  const under = est && act > 0 && act < est
                  return (
                    <div class={`${styles.taskItem} ${styles.taskItemDone}`}>
                      <div class={styles.taskCheck}>
                        <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M2 6l3 3L10 3" /></svg>
                      </div>
                      <span class={`${styles.taskTitle} ${styles.taskTitleDone}`}>{task.title}</span>
                      <Show when={est}>
                        <span class={`${styles.taskTime} ${over ? styles.taskEstOver : under ? styles.taskEstUnder : styles.taskEst}`}>
                          {formatMins(act)} / {formatMins(est!)}
                        </span>
                      </Show>
                      <Show when={!est && act > 0}>
                        <span class={styles.taskTime}>{formatMins(act)}</span>
                      </Show>
                    </div>
                  )
                }}
              </For>
            </div>
          </Show>

          {/* Incomplete tasks */}
          <Show when={data()!.incomplete_tasks.length > 0}>
            <div class={styles.section}>
              <p class={styles.sectionLabel}>
                未完成
                <span class={styles.sectionCount}>{data()!.incomplete_tasks.length}</span>
              </p>
              <For each={data()!.incomplete_tasks}>
                {(task) => (
                  <div class={styles.taskItem}>
                    <div class={`${styles.taskCheck} ${styles.taskCheckPending}`} />
                    <span class={styles.taskTitle}>{task.title}</span>
                    <Show when={task.estimated_minutes}>
                      <span class={styles.taskTime}>{formatMins(task.estimated_minutes!)}</span>
                    </Show>
                    <Show when={task.actual_focus_minutes > 0}>
                      <span class={`${styles.taskTime} ${styles.taskEstOver}`}>
                        {formatMins(task.actual_focus_minutes)} 已投入
                      </span>
                    </Show>
                  </div>
                )}
              </For>
            </div>
          </Show>

          <div class={styles.footer}>
            <button class={styles.doneBtn} onClick={props.onClose}>知道了</button>
          </div>
        </Show>
      </div>
    </div>
  )
}

export default DailyReviewDialog