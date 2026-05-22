import { type Component, createSignal, For, Show } from 'solid-js'
import styles from './CreateTaskDialog.module.css'
import { createTask as apiCreateTask, addTagToTask, invalidateAfterTaskMutation, pushToast, categories, tags } from '../../stores'

interface Props {
  open: boolean
  defaultDueDate?: string
  onClose: () => void
}

const WEEKDAYS = [
  { n: 1, l: '一' }, { n: 2, l: '二' }, { n: 3, l: '三' },
  { n: 4, l: '四' }, { n: 5, l: '五' }, { n: 6, l: '六' }, { n: 7, l: '日' },
]

const CreateTaskDialog: Component<Props> = (props) => {
  const [title, setTitle] = createSignal('')
  const [description, setDescription] = createSignal('')
  const [priority, setPriority] = createSignal(0)
  const [dueDate, setDueDate] = createSignal(props.defaultDueDate ?? '')
  const [categoryId, setCategoryId] = createSignal<number | null>(null)
  const [estimatedMinutes, setEstimatedMinutes] = createSignal<number | null>(null)
  const [selectedTags, setSelectedTags] = createSignal<number[]>([])
  const [submitting, setSubmitting] = createSignal(false)

  // Recurrence
  const [recurring, setRecurring] = createSignal(false)
  const [freq, setFreq] = createSignal<'daily' | 'weekly' | 'monthly'>('daily')
  const [interval, setInterval] = createSignal(1)
  const [days, setDays] = createSignal<number[]>([])
  const [endType, setEndType] = createSignal<'never' | 'date' | 'count'>('never')
  const [endDate, setEndDate] = createSignal('')
  const [endCount, setEndCount] = createSignal(10)

  const toggleTag = (id: number) => {
    setSelectedTags(prev => prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id])
  }

  const toggleDay = (n: number) => {
    setDays(prev => prev.includes(n) ? prev.filter(d => d !== n) : [...prev, n])
  }

  const submit = async () => {
    const t = title().trim(); if (!t) return
    setSubmitting(true)
    try {
      const rule = recurring()
        ? JSON.stringify({
            freq: freq(), interval: interval(),
            days: freq() === 'weekly' ? days() : null,
            end_type: endType(),
            end_date: endType() === 'date' ? endDate() : null,
            end_count: endType() === 'count' ? endCount() : null,
          })
        : undefined

      const taskId = await apiCreateTask({
        title: t, description: description() || null, priority: priority(),
        due_date: dueDate() || null, category_id: categoryId(),
        estimated_minutes: estimatedMinutes(),
        recurrence_rule: rule ?? null,
      })
      const stags = selectedTags()
      if (stags.length > 0) {
        await Promise.all(stags.map(tagId => addTagToTask(taskId, tagId)))
      }
      pushToast('success', '任务已创建')
      invalidateAfterTaskMutation()
      props.onClose()
    } catch (e) {
      pushToast('error', `创建失败: ${e}`)
    } finally { setSubmitting(false) }
  }

  if (!props.open) return null

  return (
    <div class={styles.overlay} onClick={props.onClose}>
      <div class={styles.dialog} onClick={(e) => e.stopPropagation()}>
        <h3 class={styles.title}>新建任务</h3>

        <input type="text" class={styles.input} value={title()} onInput={(e) => setTitle(e.currentTarget.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && title().trim()) submit(); if (e.key === 'Escape') props.onClose() }}
          placeholder="任务标题" autofocus />
        <textarea class={styles.textarea} value={description()} onInput={(e) => setDescription(e.currentTarget.value)} placeholder="描述（可选）" />

        <div class={styles.metaRow}>
          <select class={styles.select} value={priority()} onChange={(e) => setPriority(Number(e.currentTarget.value))} title="优先级">
            <option value={0}>○ 低</option>
            <option value={1}>◉ 中</option>
            <option value={2}>◉◉ 高</option>
          </select>
          <input type="date" class={styles.dateInput} value={dueDate()} onInput={(e) => setDueDate(e.currentTarget.value)} />
          <select class={styles.select} value={categoryId() ?? ''} onChange={(e) => setCategoryId(e.currentTarget.value ? Number(e.currentTarget.value) : null)}>
            <option value="">无分类</option>
            <For each={categories() ?? []}>{(c) => <option value={c.id}>{c.name}</option>}</For>
          </select>
          <select class={styles.select} value={estimatedMinutes() ?? ''} onChange={(e) => setEstimatedMinutes(e.currentTarget.value ? Number(e.currentTarget.value) : null)}>
            <option value="">耗时</option>
            <option value="15">15m</option>
            <option value="30">30m</option>
            <option value="45">45m</option>
            <option value="60">1h</option>
            <option value="90">1.5h</option>
            <option value="120">2h</option>
            <option value="180">3h</option>
            <option value="240">4h</option>
          </select>
        </div>

        <p class={styles.sectionLabel}>标签</p>
        <Show
          when={(tags() ?? []).length > 0}
          fallback={<p class={styles.tagsEmpty}>暂无标签，可在设置中创建</p>}
        >
          <div class={styles.tagsWrap}>
            <For each={tags() ?? []}>{(t) => (
              <button class={`${styles.tagChip} ${selectedTags().includes(t.id) ? styles.tagChipActive : ''}`} onClick={() => toggleTag(t.id)}>
                {t.name}
              </button>
            )}</For>
          </div>
        </Show>

        <p class={styles.sectionLabel}>重复</p>
        <div class={styles.recurToggle}>
          <button class={`${styles.recurToggleBtn} ${!recurring() ? styles.recurToggleBtnActive : ''}`} onClick={() => setRecurring(false)}>不重复</button>
          <button class={`${styles.recurToggleBtn} ${recurring() ? styles.recurToggleBtnActive : ''}`} onClick={() => setRecurring(true)}>重复</button>
        </div>

        {recurring() && (
          <div class={styles.recurPanel}>
            <div class={styles.recurRow}>
              <select class={styles.select} value={freq()} onChange={(e) => setFreq(e.currentTarget.value as 'daily' | 'weekly' | 'monthly')}>
                <option value="daily">每日</option>
                <option value="weekly">每周</option>
                <option value="monthly">每月</option>
              </select>
              <div class={styles.intervalField}>
                <span>每隔</span>
                <input
                  type="number"
                  min={1}
                  class={styles.intervalInput}
                  value={interval()}
                  onInput={(e) => setInterval(Math.max(1, Number(e.currentTarget.value)))}
                />
                <span>{freq() === 'daily' ? '天' : freq() === 'weekly' ? '周' : '个月'}</span>
              </div>
            </div>

            {freq() === 'weekly' && (
              <div class={styles.weekdayRow}>
                <For each={WEEKDAYS}>{(d) => (
                  <button class={`${styles.weekdayBtn} ${days().includes(d.n) ? styles.weekdayBtnActive : ''}`} onClick={() => toggleDay(d.n)}>
                    {d.l}
                  </button>
                )}</For>
              </div>
            )}

            <div class={styles.endRow}>
              <label class={styles.radioLabel}><input type="radio" name="end" checked={endType() === 'never'} onChange={() => setEndType('never')} />永不停止</label>
              <label class={styles.radioLabel}><input type="radio" name="end" checked={endType() === 'date'} onChange={() => setEndType('date')} />到日期</label>
              <label class={styles.radioLabel}><input type="radio" name="end" checked={endType() === 'count'} onChange={() => setEndType('count')} />重复</label>
              {endType() === 'date' && (
                <input type="date" class={styles.endDateInput} value={endDate()} onInput={(e) => setEndDate(e.currentTarget.value)} />
              )}
              {endType() === 'count' && (
                <input
                  type="number"
                  min={1}
                  class={styles.endCountInput}
                  value={endCount()}
                  onInput={(e) => setEndCount(Math.max(1, Number(e.currentTarget.value)))}
                />
              )}
              {endType() === 'count' && <span class={styles.endCountSuffix}>次</span>}
            </div>
          </div>
        )}

        <div class={styles.actions}>
          <button class={styles.cancelBtn} onClick={props.onClose}>取消</button>
          <button class={styles.submitBtn} disabled={!title().trim() || submitting()} onClick={submit}>
            {submitting() ? '创建中…' : '创建'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default CreateTaskDialog
