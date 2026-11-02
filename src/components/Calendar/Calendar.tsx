import { type Component, For, Show, onCleanup } from 'solid-js'
import styles from './Calendar.module.css'
import {
  calendarYear,
  setCalendarYear,
  calendarMonth,
  setCalendarMonth,
  calendarData,
  selectedDate,
  setSelectedDate,
  updateTask,
  updateMatterStep,
  invalidateAfterTaskMutation,
  pushToast,
  tasks,
  agenda,
  completeTaskFromList,
  selectTask,
  refetchTasks,
} from '../../stores'
import CalendarDay from '../CalendarDay/CalendarDay'
import TaskList from '../TaskList/TaskList'
import Schedule from '../Schedule/Schedule'
import { localDateString, replaceDueDay } from '../../utils/date'
import type { DueDragPayload } from '../../utils/dueDrag'

const WEEKDAYS = ['一','二','三','四','五','六','日']

interface Props {
  onDoubleClickDate: (date: string) => void
}

const Calendar: Component<Props> = (props) => {
  onCleanup(() => setSelectedDate(null))
  const prev = () => calendarMonth() === 1 ? (setCalendarYear(y => y - 1), setCalendarMonth(12)) : setCalendarMonth(m => m - 1)
  const next = () => calendarMonth() === 12 ? (setCalendarYear(y => y + 1), setCalendarMonth(1)) : setCalendarMonth(m => m + 1)

  const isToday = (ds: string) => ds === localDateString()

  const days = () => calendarData() ?? []
  const offset = days().length > 0 ? (new Date(days()[0].date + 'T00:00:00').getDay() + 6) % 7 : 0

  const handleDrop = async (date: string, payload: DueDragPayload) => {
    try {
      const existing = payload.due
        ?? (payload.kind === 'task'
          ? (tasks() ?? []).find((t) => t.id === payload.id)?.due_date ?? null
          : (agenda() ?? []).find((i) => i.kind === 'matter_step' && i.id === payload.id)?.due_date ?? null)
      const nextDue = replaceDueDay(existing, date)
      if (payload.kind === 'task') {
        await updateTask(payload.id, { due_date: nextDue })
      } else {
        await updateMatterStep(payload.id, { due_date: nextDue })
      }
      pushToast('success', '日期已更新')
      invalidateAfterTaskMutation()
    } catch (e) {
      pushToast('error', '更新失败')
    }
  }

  return (
    <div class={styles.container}>
      <div class={styles.header}>
        <div class={styles.navGroup}>
          <button class={styles.navBtn} onClick={prev}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 3L5 8l5 5" /></svg>
          </button>
          <span class={styles.monthLabel}>{calendarYear()} 年 {calendarMonth()} 月</span>
          <button class={styles.navBtn} onClick={next}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3l5 5-5 5" /></svg>
          </button>
          <button class={styles.todayBtn} onClick={() => { setCalendarYear(new Date().getFullYear()); setCalendarMonth(new Date().getMonth() + 1) }}>今天</button>
        </div>
        {calendarData.loading && <div class={styles.spinner} />}
      </div>

      <div class={styles.weekdays}>
        <For each={WEEKDAYS}>{(d) => <div class={styles.weekday}>{d}</div>}</For>
      </div>

      <Show when={!calendarData.loading || days().length === 0} fallback={
        <div class={styles.grid}>
          <For each={Array.from({ length: 35 })}>{() => (
            <div class={styles.placeholder}>
              <div class={styles.skeletonDay + ' skeleton'} style={{ display: 'inline-block' }} />
            </div>
          )}</For>
        </div>
      }>
        <div class={styles.grid}>
          <For each={Array.from({ length: offset })}>{() => <div class={styles.placeholder} />}</For>
          <For each={days()}>
            {(day) => (
              <CalendarDay
                data={day}
                isToday={isToday(day.date)}
                isSelected={selectedDate() === day.date}
                onSelect={() => setSelectedDate(selectedDate() === day.date ? null : day.date)}
                onDoubleClick={() => props.onDoubleClickDate(day.date)}
                onDrop={(payload) => handleDrop(day.date, payload)}
              />
            )}
          </For>
        </div>
      </Show>

      <Show when={selectedDate()}>
        {(date) => (
          <div class={styles.dayPanel}>
            <TaskList
              title="当天任务"
              compact
              tasks={tasks ? (tasks() ?? []) : []}
              loading={tasks?.loading ?? false}
              error={tasks?.error ? String(tasks.error) : null}
              onTaskToggle={(id) => void completeTaskFromList(id)}
              onTaskClick={(id) => selectTask(id)}
              onRetry={refetchTasks}
            />
            <Schedule date={date()} />
          </div>
        )}
      </Show>
    </div>
  )
}

export default Calendar
