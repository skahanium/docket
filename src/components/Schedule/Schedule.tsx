import { type Component, createSignal, createResource, Switch, Match, Show, For } from 'solid-js'
import styles from './Schedule.module.css'
import {
  getSchedule,
  autoSchedule,
  removeScheduleEntry,
  clearSchedule,
  invalidateAfterTaskMutation,
  pushToast,
  selectTask,
  deselectTask,
  clearFilters,
} from '../../stores'

const WEEKDAY_LABELS = ['日', '一', '二', '三', '四', '五', '六']

function formatMinutes(m: number): string {
  if (m >= 60) { const h = Math.floor(m / 60); const min = m % 60; return min > 0 ? `${h}h ${min}m` : `${h}h` }
  return `${m}m`
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}

const Schedule: Component = () => {
  const [scheduleDate, setScheduleDate] = createSignal(todayStr())
  const [refetchTrigger, setRefetchTrigger] = createSignal(0)

  const [scheduleData] = createResource(
    () => ({ date: scheduleDate(), trigger: refetchTrigger() }),
    async ({ date }) => {
      try { return await getSchedule(date) } catch { return null }
    },
  )

  const data = () => scheduleData()

  const prevDay = () => {
    const d = new Date(scheduleDate() + 'T00:00:00')
    d.setDate(d.getDate() - 1)
    setScheduleDate(d.toISOString().slice(0, 10))
  }

  const nextDay = () => {
    const d = new Date(scheduleDate() + 'T00:00:00')
    d.setDate(d.getDate() + 1)
    setScheduleDate(d.toISOString().slice(0, 10))
  }

  const goToday = () => setScheduleDate(todayStr())

  const handleAutoSchedule = async () => {
    try {
      await autoSchedule(scheduleDate())
      setRefetchTrigger(t => t + 1)
      pushToast('success', '日程已自动排好')
      invalidateAfterTaskMutation()
    } catch (e) {
      pushToast('error', `排程失败: ${e}`)
    }
  }

  const handleClear = async () => {
    try {
      await clearSchedule(scheduleDate())
      setRefetchTrigger(t => t + 1)
      invalidateAfterTaskMutation()
    } catch (e) {
      pushToast('error', `清空失败: ${e}`)
    }
  }

  const handleRemove = async (taskId: number) => {
    try {
      await removeScheduleEntry(taskId, scheduleDate())
      setRefetchTrigger(t => t + 1)
      invalidateAfterTaskMutation()
    } catch { }
  }

  const handleClick = (taskId: number) => {
    clearFilters()
    deselectTask()
    selectTask(taskId)
  }

  const dateLabel = () => {
    const d = new Date(scheduleDate() + 'T00:00:00')
    const now = new Date()
    const diff = Math.floor((d.getTime() - now.getTime()) / 86400000)
    let label = `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`
    if (diff === 0) label = `今天 · ${label}`
    else if (diff === 1) label = `明天 · ${label}`
    else if (diff === -1) label = `昨天 · ${label}`
    return label
  }

  const weekdayLabel = () => {
    const d = new Date(scheduleDate() + 'T00:00:00')
    return `周${WEEKDAY_LABELS[d.getDay()]}`
  }

  const gaugeColor = () => {
    const d = data()
    if (!d || d.available_minutes === 0) return 'var(--accent)'
    const ratio = d.scheduled_minutes / d.available_minutes
    if (ratio > 1) return 'var(--danger)'
    if (ratio > 0.8) return 'var(--warning)'
    return 'var(--success)'
  }

  const gaugePct = () => {
    const d = data()
    if (!d || d.available_minutes === 0) return 0
    return Math.min(100, Math.round((d.scheduled_minutes / d.available_minutes) * 100))
  }

  const priorityClass = (p: number) => {
    if (p >= 2) return styles.priorityHigh
    if (p >= 1) return styles.priorityMed
    return ''
  }

  const priorityText = (p: number) => {
    if (p >= 2) return '●●'
    if (p >= 1) return '●'
    return ''
  }

  return (
    <div class={styles.container}>
      {/* Header */}
      <div class={styles.header}>
        <div class={styles.dateRow}>
          <button class={styles.navBtn} onClick={prevDay}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M10 3L5 8l5 5" /></svg>
          </button>
          <span class={styles.dateLabel}>{dateLabel()}</span>
          <span class={styles.weekday}>{weekdayLabel()}</span>
          <button class={styles.navBtn} onClick={nextDay}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 3l5 5-5 5" /></svg>
          </button>
          <button class={styles.todayBtn} onClick={goToday}>今天</button>
        </div>
        <div class={styles.actions}>
          {scheduleData.loading && <div class={styles.spinner} />}
          <button class={styles.autoBtn} onClick={handleAutoSchedule} disabled={scheduleData.loading}>
            自动排程
          </button>
          <button class={styles.clearBtn} onClick={handleClear}>
            清空
          </button>
        </div>
      </div>

      {/* Workload Gauge */}
      <Show when={data()}>
        <div class={styles.gaugeRow}>
          <span class={styles.gaugeLabel}>已安排 {formatMinutes(data()!.scheduled_minutes)}</span>
          <div class={styles.gauge}>
            <div class={styles.gaugeFill} style={{ width: `${gaugePct()}%`, background: gaugeColor() }} />
          </div>
          <span class={styles.gaugeLabel}>可用 {formatMinutes(data()!.available_minutes)}</span>
        </div>
      </Show>

      <Switch>
        <Match when={scheduleData.loading}>
          <div class={styles.block}>
            <div class={styles.blockHeader}>
              <span class={styles.blockLabel}>上午</span>
              <div class={styles.blockDivider} />
            </div>
            <div class={styles.timelineEmpty}>加载中…</div>
          </div>
        </Match>

        <Match when={!data()}>
          <div class={styles.timelineEmpty}>加载失败</div>
        </Match>

        <Match when={!data()!.is_workday}>
          <div class={styles.timelineEmpty} style="padding:48px 0;text-align:center;">
            <p style="font-size:18px;color:var(--text-sub);margin-bottom:8px;">休息日</p>
            <p style="font-size:14px;color:var(--text-label);">今天是节假日或周末，无需排程</p>
          </div>
        </Match>

        <Match when={true}>
          {/* AM Block */}
          <div class={styles.block}>
            <div class={styles.blockHeader}>
              <span class={styles.blockLabel}>上午</span>
              <span class={styles.blockTime}>{data()!.am_block.start} - {data()!.am_block.end}</span>
              <div class={styles.blockDivider} />
            </div>
            <div class={styles.timeline}>
              <Show when={data()!.entries.filter(e => e.start_time < data()!.pm_block.start).length > 0} fallback={
                <div class={styles.timelineEmpty}>暂无安排</div>
              }>
                <For each={data()!.entries.filter(e => e.start_time < data()!.pm_block.start)}>
                  {(entry) => (
                    <div class={`${styles.timelineCard} ${entry.completed ? styles.timelineCardCompleted : ''}`} onClick={() => handleClick(entry.task_id)}>
                      <span class={styles.timeBadge}>{entry.start_time}</span>
                      <span class={styles.priority + ' ' + priorityClass(entry.task_priority)}>{priorityText(entry.task_priority)}</span>
                      {entry.category_color && <span class={styles.colorDot} style={{ background: entry.category_color }} />}
                      <div class={styles.cardBody}>
                        <span class={`${styles.cardTitle} ${entry.completed ? styles.cardTitleDone : ''}`}>{entry.task_title}</span>
                      </div>
                      <span class={styles.cardDur}>{formatMinutes(entry.duration_minutes)}</span>
                      <button class={styles.removeCardBtn} onClick={(e) => { e.stopPropagation(); handleRemove(entry.task_id) }}>×</button>
                    </div>
                  )}
                </For>
              </Show>
            </div>
          </div>

          {/* PM Block */}
          <div class={styles.block}>
            <div class={styles.blockHeader}>
              <span class={styles.blockLabel}>下午</span>
              <span class={styles.blockTime}>{data()!.pm_block.start} - {data()!.pm_block.end}</span>
              <div class={styles.blockDivider} />
            </div>
            <div class={styles.timeline}>
              <Show when={data()!.entries.filter(e => e.start_time >= data()!.pm_block.start).length > 0} fallback={
                <div class={styles.timelineEmpty}>暂无安排</div>
              }>
                <For each={data()!.entries.filter(e => e.start_time >= data()!.pm_block.start)}>
                  {(entry) => (
                    <div class={`${styles.timelineCard} ${entry.completed ? styles.timelineCardCompleted : ''}`} onClick={() => handleClick(entry.task_id)}>
                      <span class={styles.timeBadge}>{entry.start_time}</span>
                      <span class={styles.priority + ' ' + priorityClass(entry.task_priority)}>{priorityText(entry.task_priority)}</span>
                      {entry.category_color && <span class={styles.colorDot} style={{ background: entry.category_color }} />}
                      <div class={styles.cardBody}>
                        <span class={`${styles.cardTitle} ${entry.completed ? styles.cardTitleDone : ''}`}>{entry.task_title}</span>
                      </div>
                      <span class={styles.cardDur}>{formatMinutes(entry.duration_minutes)}</span>
                      <button class={styles.removeCardBtn} onClick={(e) => { e.stopPropagation(); handleRemove(entry.task_id) }}>×</button>
                    </div>
                  )}
                </For>
              </Show>
            </div>
          </div>

          {/* Unscheduled Tasks */}
          <Show when={data()!.unscheduled.length > 0}>
            <div class={styles.unscheduledSection}>
              <div class={styles.unscheduledHeader}>
                <span class={styles.unscheduledTitle}>未安排</span>
                <span class={styles.unscheduledCount}>{data()!.unscheduled.length} 项</span>
              </div>
              <div class={styles.unscheduledList}>
                <For each={data()!.unscheduled}>
                  {(entry) => (
                    <div class={styles.unscheduledCard} onClick={() => handleClick(entry.task_id)}>
                      <span class={styles.priority + ' ' + priorityClass(entry.task_priority)}>{priorityText(entry.task_priority)}</span>
                      {entry.category_color && <span class={styles.colorDot} style={{ background: entry.category_color }} />}
                      <span class={styles.cardTitle}>{entry.task_title}</span>
                      <span class={styles.cardDur}>{formatMinutes(entry.duration_minutes)}</span>
                    </div>
                  )}
                </For>
              </div>
            </div>
          </Show>
        </Match>
      </Switch>
    </div>
  )
}

export default Schedule