import { type Component, Show, createSignal, For, createEffect } from 'solid-js'
import styles from './TaskDetail.module.css'
import {
  taskDetail,
  deselectTask,
  pushToast,
  invalidateAfterTaskMutation,
  categories,
  tags,
  updateTask,
  completeTask,
  deleteTask,
  archiveTask,
  restoreTask,
  addReminder,
  removeReminder,
  addTagToTask,
  removeTagFromTask,
  startFocus,
  stopFocus,
  abandonFocus,
  getCurrentFocus,
  getTaskFocusHistory,
} from '../../stores'
import type { FocusSession } from '../../bindings/types'
import { WebviewWindow } from '@tauri-apps/api/webviewWindow'
import SubtaskList from '../SubtaskList/SubtaskList'
import Button from '../shared/Button'
import ConfirmDialog from '../ConfirmDialog/ConfirmDialog'

const STATUS_LABELS: Record<string, string> = {
  active: '进行中',
  completed: '已完成',
  archived: '已归档',
}

const PRIORITY_OPTIONS = [
  { value: 0, label: '低' },
  { value: 1, label: '中' },
  { value: 2, label: '高' },
]

const TaskDetail: Component = () => {
  const detail = () => taskDetail()
  const open = () => taskDetail.state === 'ready' && detail() !== null

  const [editingDesc, setEditingDesc] = createSignal(false)
  const [descDraft, setDescDraft] = createSignal('')
  const [remindAt, setRemindAt] = createSignal('')
  const [addingTag, setAddingTag] = createSignal(false)
  const [confirmAction, setConfirmAction] = createSignal<{ title: string; message: string; fn: () => void; danger?: boolean } | null>(null)
  const [activeFocus, setActiveFocus] = createSignal<FocusSession | null>(null)
  const [focusHistory, setFocusHistory] = createSignal<FocusSession[]>([])
  const [startingFocus, setStartingFocus] = createSignal(false)

  const loadFocusState = async () => {
    try {
      const current = await getCurrentFocus()
      setActiveFocus(current)
      if (detail()) {
        getTaskFocusHistory(detail()!.id).then(setFocusHistory)
      }
    } catch { }
  }

  // Focus actions
  const startFocusSession = async () => {
    if (!detail() || startingFocus()) return
    setStartingFocus(true)
    try {
      const session = await startFocus(detail()!.id)
      setActiveFocus(session)
      pushToast('success', '专注已开始')
      // Show the focus window
      try {
        const focusWindow = await WebviewWindow.getByLabel('focus')
        if (focusWindow) {
          await focusWindow.show()
          await focusWindow.setFocus()
        }
      } catch { }
    } catch (e) {
      pushToast('error', `启动失败: ${e}`)
    } finally {
      setStartingFocus(false)
    }
  }

  const stopFocusSession = async () => {
    if (!activeFocus()) return
    try {
      await stopFocus(activeFocus()!.id, true)
      setActiveFocus(null)
      pushToast('success', '专注已完成')
      invalidateAfterTaskMutation({ stats: true })
      loadFocusState()
    } catch (e) {
      pushToast('error', `操作失败: ${e}`)
    }
  }

  const abandonFocusSession = async () => {
    if (!activeFocus()) return
    try {
      await abandonFocus(activeFocus()!.id)
      setActiveFocus(null)
      loadFocusState()
    } catch { }
  }

  const formatMinutes = (m: number | null | undefined) => {
    if (!m) return null
    if (m >= 60) {
      const h = Math.floor(m / 60)
      const min = m % 60
      return min > 0 ? `${h}h ${min}m` : `${h}h`
    }
    return `${m}m`
  }

  const act = async (fn: () => Promise<void>, msg: string) => {
    try { await fn(); pushToast('success', msg); invalidateAfterTaskMutation() }
    catch (e) { pushToast('error', `操作失败: ${e}`) }
  }

  const updateProp = (patch: Record<string, any>, msg = '已更新') => {
    if (!detail()) return
    act(() => updateTask(detail()!.id, patch), msg)
  }

  createEffect(() => {
    if (open() && detail()) {
      setEditingDesc(false)
      setDescDraft(detail()!.description ?? '')
      setRemindAt('')
      setAddingTag(false)
      loadFocusState()
    }
  })

  const availableTags = () => {
    const d = detail()
    if (!d) return []
    const usedIds = new Set(d.tags.map(t => t.id))
    return (tags() ?? []).filter(t => !usedIds.has(t.id))
  }

  return (
    <Show when={open()}>
      <div class={styles.overlay} onClick={deselectTask} />
      <div class={styles.panel}>
        <div class={styles.header}>
          <h3 class={styles.title}>任务详情</h3>
          <button class={styles.closeBtn} onClick={deselectTask}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 4l8 8M12 4l-8 8" /></svg>
          </button>
        </div>

        <Show when={detail()} fallback={<div class={styles.body}><p style="font-size:14px;color:var(--text-sub)">加载中…</p></div>}>
          <div class={styles.body}>
            <input type="text" class={styles.taskTitle} value={detail()!.title}
              onBlur={(e) => { if (e.currentTarget.value !== detail()!.title) updateProp({ title: e.currentTarget.value }) }}
              onKeyDown={(e) => { if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur() }} />

            {/* Description */}
            <Show when={!editingDesc()} fallback={
              <textarea class={styles.descTextarea} value={descDraft()}
                onInput={(e) => setDescDraft(e.currentTarget.value)}
                onBlur={() => { updateProp({ description: descDraft() || null }); setEditingDesc(false) }}
                onKeyDown={(e) => { if (e.key === 'Escape') { setEditingDesc(false) } }}
                autofocus />
            }>
              <Show when={detail()!.description} fallback={
                <button class={styles.addDescBtn} onClick={() => { setDescDraft(''); setEditingDesc(true) }}>
                  + 添加描述
                </button>
              }>
                <p class={styles.descText} onClick={() => { setDescDraft(detail()!.description ?? ''); setEditingDesc(true) }}>
                  {detail()!.description}
                </p>
              </Show>
            </Show>

            {/* Property rows */}
            <div class={styles.propGroup}>
              <div class={styles.propRow}>
                <span class={styles.propLabel}>状态</span>
                <span class={styles.propValue}>{STATUS_LABELS[detail()!.status] ?? detail()!.status}</span>
              </div>

              <div class={styles.propRow}>
                <span class={styles.propLabel}>优先级</span>
                <select class={styles.propSelect} value={detail()!.priority}
                  onChange={(e) => updateProp({ priority: Number(e.currentTarget.value) })}>
                  <For each={PRIORITY_OPTIONS}>{(o) => <option value={o.value}>{o.label}</option>}</For>
                </select>
              </div>

              <div class={styles.propRow}>
                <span class={styles.propLabel}>截止日期</span>
                <input type="date" class={styles.propDate} value={detail()!.due_date ?? ''}
                  onChange={(e) => updateProp({ due_date: e.currentTarget.value || null, clear_due_date: !e.currentTarget.value ? true : undefined })} />
                <Show when={detail()!.due_date}>
                  <button class={styles.clearBtn} onClick={() => updateProp({ clear_due_date: true })} title="清除日期">×</button>
                </Show>
              </div>

              <div class={styles.propRow}>
                <span class={styles.propLabel}>分类</span>
                <select class={styles.propSelect} value={detail()!.category_id ?? ''}
                  onChange={(e) => updateProp({ category_id: e.currentTarget.value ? Number(e.currentTarget.value) : null, clear_category_id: !e.currentTarget.value ? true : undefined })}>
                  <option value="">无分类</option>
                  <For each={categories() ?? []}>{(c) => <option value={c.id}>{c.name}</option>}</For>
                </select>
              </div>

              <div class={styles.propRow}>
                <span class={styles.propLabel}>预计耗时</span>
                <select class={styles.propSelect} value={detail()!.estimated_minutes ?? ''}
                  onChange={(e) => {
                    const v = e.currentTarget.value
                    updateProp(v ? { estimated_minutes: Number(v) } : { clear_estimated_minutes: true })
                  }}>
                  <option value="">未设置</option>
                  <option value="15">15 分钟</option>
                  <option value="30">30 分钟</option>
                  <option value="45">45 分钟</option>
                  <option value="60">1 小时</option>
                  <option value="90">1.5 小时</option>
                  <option value="120">2 小时</option>
                  <option value="180">3 小时</option>
                  <option value="240">4 小时</option>
                  <option value="480">8 小时</option>
                </select>
              </div>
            </div>

            {/* Tags */}
            <div>
              <div class={styles.propRow}>
                <span class={styles.propLabel}>标签</span>
              </div>
              <div class={styles.tagRow}>
                <For each={detail()!.tags}>{(t) => (
                  <span class={styles.tag} style={{ background: `${t.color ?? '#737373'}16`, color: t.color ?? 'var(--text-sub)' }}>
                    {t.name}
                    <button class={styles.tagRemoveBtn} onClick={() => act(() => removeTagFromTask(detail()!.id, t.id), '已移除标签')}>×</button>
                  </span>
                )}</For>
                <Show when={!addingTag()} fallback={
                  <select class={styles.propSelect} value="" onChange={(e) => {
                    if (e.currentTarget.value) act(() => addTagToTask(detail()!.id, Number(e.currentTarget.value)), '已添加标签')
                    setAddingTag(false)
                  }}>
                    <option value="">选择标签…</option>
                    <For each={availableTags()}>{(t) => <option value={t.id}>{t.name}</option>}</For>
                  </select>
                }>
                  <Show when={availableTags().length > 0}>
                    <button class={styles.addTagBtn} onClick={() => setAddingTag(true)}>+ 标签</button>
                  </Show>
                </Show>
              </div>
            </div>

            {/* Recurrence */}
            <Show when={detail()!.recurrence_rule}>
              <div>
                <p class={styles.sectionLabel}>重复规则</p>
                <p class={styles.recurSummary}>
                  {(() => {
                    try {
                      const r = JSON.parse(detail()!.recurrence_rule!)
                      const freqLabel = ({ daily: '每天', weekly: '每周', monthly: '每月' } as Record<string, string>)[r.freq] ?? r.freq
                      const daysStr = r.days?.length ? ' (' + r.days.map((d: number) => '一二三四五六日'[d - 1]).join('') + ')' : ''
                      const endStr = r.end_type === 'never' ? '永不停止' : r.end_type === 'date' ? `至 ${r.end_date}` : `共 ${r.end_count} 次`
                      return `${freqLabel}${r.interval > 1 ? ` · 间隔${r.interval}` : ''}${daysStr} · ${endStr}`
                    } catch { return detail()!.recurrence_rule }
                  })()}
                </p>
              </div>
            </Show>

            <hr class={styles.divider} />
            <SubtaskList taskId={detail()!.id} subtasks={detail()!.subtasks} />

            <hr class={styles.divider} />

            {/* Focus Section */}
            <div>
              <p class={styles.sectionLabel}>专注</p>
              <Show when={activeFocus()} fallback={
                <button class={styles.addDescBtn} style="border:1px solid var(--accent);color:var(--accent)" onClick={startFocusSession} disabled={startingFocus()}>
                  {startingFocus() ? '启动中…' : '▶ 开始专注'}
                </button>
              }>
                <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
                  <span style="font-size:14px;color:var(--accent);font-weight:500;">
                    专注中…
                  </span>
                  <button class={styles.addDescBtn} style="padding:6px 14px;font-size:13px;border-color:var(--success);color:var(--success)" onClick={stopFocusSession}>
                    完成
                  </button>
                  <button class={styles.addDescBtn} style="padding:6px 14px;font-size:13px;border-color:var(--danger);color:var(--danger)" onClick={abandonFocusSession}>
                    放弃
                  </button>
                </div>
              </Show>

              <Show when={focusHistory().length > 0}>
                <div style="margin-top:10px;display:flex;flex-wrap:wrap;gap:6px;">
                  {focusHistory().slice(0, 10).map((s) => (
                    <span style={{
                      'font-size': '12px', padding: '3px 10px', 'border-radius': '99px',
                      background: s.completed ? 'var(--success-light)' : 'var(--bg-hover)',
                      color: s.completed ? 'var(--success)' : 'var(--text-label)',
                      'font-family': 'var(--font-mono)',
                    }}>
                      {formatMinutes(s.duration_minutes) ?? '未记录'}
                    </span>
                  ))}
                </div>
              </Show>
            </div>

            <hr class={styles.divider} />

            {/* Reminders */}
            <div>
              <p class={styles.sectionLabel}>提醒</p>
              <For each={detail()!.reminders}>{(r) => (
                <div class={styles.reminderItem}>
                  <span style={{
                    width: '8px', height: '8px', 'border-radius': '50%', 'flex-shrink': 0,
                    background: r.notified ? 'var(--success)' : 'var(--accent)',
                  }} />
                  <span>{new Date(r.remind_at).toLocaleString()}</span>
                  <button class={styles.reminderDeleteBtn} onClick={() => act(() => removeReminder(r.id), '已删除提醒')}>×</button>
                </div>
              )}</For>
              <div class={styles.reminderAddRow}>
                <input type="datetime-local" class={styles.reminderInput} value={remindAt()} onInput={(e) => setRemindAt(e.currentTarget.value)} />
                <button class={styles.reminderAddBtn} disabled={!remindAt()} onClick={async () => {
                  if (!detail()) return
                  try { await addReminder(detail()!.id, new Date(remindAt()).toISOString()); setRemindAt(''); invalidateAfterTaskMutation({ calendar: false }) }
                  catch (e) { pushToast('error', `添加失败: ${e}`) }
                }}>添加</button>
              </div>
            </div>
          </div>

          <div class={styles.footer}>
            <Show when={detail()!.status === 'active'}>
              <Button variant="success" onClick={() => act(() => completeTask(detail()!.id), '已完成')}>完成</Button>
            </Show>
            <Show when={detail()!.status !== 'archived'}>
              <Button variant="secondary" onClick={() => setConfirmAction({ title: '归档任务', message: '确认归档此任务？归档后可恢复。', fn: () => { act(() => archiveTask(detail()!.id), '已归档'); deselectTask() }, danger: false })}>归档</Button>
            </Show>
            <Show when={detail()!.status === 'archived'}>
              <Button variant="secondary" onClick={() => act(() => restoreTask(detail()!.id), '已恢复')}>恢复</Button>
            </Show>
            <Button variant="danger" onClick={() => setConfirmAction({ title: '删除任务', message: '确认删除此任务？此操作不可撤销。', fn: () => { act(() => deleteTask(detail()!.id), '已删除'); deselectTask() }, danger: true })}>删除</Button>
          </div>
        </Show>
      </div>
      <ConfirmDialog
        open={!!confirmAction()}
        title={confirmAction()?.title ?? ''}
        message={confirmAction()?.message ?? ''}
        danger={confirmAction()?.danger}
        confirmLabel="确认"
        onConfirm={() => { confirmAction()?.fn(); setConfirmAction(null) }}
        onCancel={() => setConfirmAction(null)}
      />
    </Show>
  )
}

export default TaskDetail
