import { type Component, Show, createResource, createSignal, createEffect } from 'solid-js'
import styles from './SettingsPanel.module.css'
import type { Settings } from '../../bindings/types'
import {
  getSettings,
  updateSettings,
  listHolidays,
  fetchHolidaysOnline,
  getDatabasePath,
  revealDatabaseFolder,
  getNotificationSettings,
  updateNotificationSettings,
  pushToast,
} from '../../stores'
import type { NotificationSettings } from '../../bindings/notifications'
import {
  getPanelSettings,
  updatePanelSettings,
  type PanelSettings,
} from '../../bindings/panel'

const SettingsPanel: Component = () => {
  const [loaded] = createResource(getSettings)
  const [draft, setDraft] = createSignal<Settings | null>(null)
  const [saving, setSaving] = createSignal(false)
  const [dbPath] = createResource(getDatabasePath)
  const [holidayCount, { refetch: refetchHolidayCount }] = createResource(
    async () => (await listHolidays()).length,
  )
  const [notifyLoaded] = createResource(getNotificationSettings)
  const [notifyDraft, setNotifyDraft] = createSignal<NotificationSettings | null>(null)
  const [panelLoaded] = createResource(getPanelSettings)
  const [panelDraft, setPanelDraft] = createSignal<PanelSettings | null>(null)

  createEffect(() => {
    const n = notifyLoaded()
    if (n) setNotifyDraft({ ...n })
  })

  createEffect(() => {
    const s = loaded()
    if (s) setDraft({ ...s })
  })

  createEffect(() => {
    const p = panelLoaded()
    if (p) setPanelDraft({ ...p })
  })

  const save = async () => {
    const s = draft()
    if (!s) return
    setSaving(true)
    try {
      await updateSettings(s)
      pushToast('success', '设置已保存')
    } catch {
      pushToast('error', '保存失败')
    } finally {
      setSaving(false)
    }
  }

  const syncHolidays = async () => {
    const ok = window.confirm(
      '将访问 timor.tech 下载当年节假日数据，仅写入本地数据库，不会上传任何任务内容。是否继续？',
    )
    if (!ok) return
    try {
      const year = new Date().getFullYear()
      const list = await fetchHolidaysOnline(year, true)
      await refetchHolidayCount()
      pushToast('success', `已同步 ${year} 年节假日（${list.length} 条）`)
    } catch (e) {
      pushToast('error', String(e))
    }
  }

  const copyPath = async () => {
    const path = dbPath()
    if (!path) return
    try {
      await navigator.clipboard.writeText(path)
      pushToast('success', '路径已复制')
    } catch {
      pushToast('error', '复制失败')
    }
  }

  const openFolder = async () => {
    try {
      await revealDatabaseFolder()
    } catch {
      pushToast('error', '无法打开文件夹')
    }
  }

  const patch = (key: keyof Settings, value: string) => {
    const s = draft()
    if (!s) return
    setDraft({ ...s, [key]: value })
  }

  return (
    <div class={styles.container}>
      <h2 class={styles.title}>设置</h2>

      <section class={styles.section}>
        <p class={styles.sectionTitle}>工作时间</p>
        <Show when={draft()} fallback={<p class={styles.hint}>加载中…</p>}>
          <div class={styles.grid}>
            {([
              ['work_start_am', '上午开始'],
              ['work_end_am', '上午结束'],
              ['work_start_pm', '下午开始'],
              ['work_end_pm', '下午结束'],
              ['default_focus_minutes', '默认专注（分钟）'],
            ] as const).map(([key, label]) => (
              <label class={styles.field}>
                <span class={styles.label}>{label}</span>
                <input
                  class={styles.input}
                  value={draft()![key]}
                  onInput={(e) => patch(key, e.currentTarget.value)}
                />
              </label>
            ))}
          </div>
          <button
            class={`${styles.btn} ${styles.btnPrimary}`}
            style={{ 'margin-top': '12px' }}
            disabled={saving()}
            onClick={() => void save()}
          >
            {saving() ? '保存中…' : '保存'}
          </button>
        </Show>
      </section>

      <section class={styles.section}>
        <p class={styles.sectionTitle}>桌面任务面板</p>
        <Show when={panelDraft()} fallback={<p class={styles.hint}>加载中…</p>}>
          <label class={styles.field} style={{ 'flex-direction': 'row', 'align-items': 'center', gap: '8px' }}>
            <input
              type="checkbox"
              checked={panelDraft()!.panel_always_on_top}
              onChange={(e) =>
                setPanelDraft((p) => (p ? { ...p, panel_always_on_top: e.currentTarget.checked } : p))
              }
            />
            <span class={styles.label}>窗口置顶（关闭后可被其它窗口遮挡）</span>
          </label>
          <label class={styles.field} style={{ 'flex-direction': 'row', 'align-items': 'center', gap: '8px' }}>
            <input
              type="checkbox"
              checked={panelDraft()!.panel_opaque}
              onChange={(e) =>
                setPanelDraft((p) => (p ? { ...p, panel_opaque: e.currentTarget.checked } : p))
              }
            />
            <span class={styles.label}>不透明背景（关闭毛玻璃，适合老机器）</span>
          </label>
          <label class={styles.field}>
            <span class={styles.label}>可见时刷新间隔（秒，30–600）</span>
            <input
              class={styles.input}
              type="number"
              min={30}
              max={600}
              value={panelDraft()!.panel_refresh_seconds}
              onInput={(e) =>
                setPanelDraft((p) =>
                  p
                    ? {
                        ...p,
                        panel_refresh_seconds: Math.min(
                          600,
                          Math.max(30, Number(e.currentTarget.value) || 120),
                        ),
                      }
                    : p,
                )
              }
            />
          </label>
          <button
            class={`${styles.btn} ${styles.btnPrimary}`}
            style={{ 'margin-top': '8px' }}
            onClick={async () => {
              const p = panelDraft()
              if (!p) return
              try {
                await updatePanelSettings(p)
                pushToast('success', '面板设置已保存')
              } catch {
                pushToast('error', '保存失败')
              }
            }}
          >
            保存面板设置
          </button>
        </Show>
      </section>

      <section class={styles.section}>
        <p class={styles.sectionTitle}>通知</p>
        <Show when={notifyDraft()} fallback={<p class={styles.hint}>加载中…</p>}>
          <label class={styles.field} style={{ 'flex-direction': 'row', 'align-items': 'center', gap: '8px' }}>
            <input
              type="checkbox"
              checked={notifyDraft()!.notify_daily_summary}
              onChange={(e) => setNotifyDraft((n) => n ? { ...n, notify_daily_summary: e.currentTarget.checked } : n)}
            />
            <span class={styles.label}>每日摘要（本地通知）</span>
          </label>
          <label class={styles.field}>
            <span class={styles.label}>摘要时间 (HH:MM)</span>
            <input
              class={styles.input}
              value={notifyDraft()!.notify_daily_time}
              onInput={(e) => setNotifyDraft((n) => n ? { ...n, notify_daily_time: e.currentTarget.value } : n)}
            />
          </label>
          <label class={styles.field} style={{ 'flex-direction': 'row', 'align-items': 'center', gap: '8px' }}>
            <input
              type="checkbox"
              checked={notifyDraft()!.notify_overdue}
              onChange={(e) => setNotifyDraft((n) => n ? { ...n, notify_overdue: e.currentTarget.checked } : n)}
            />
            <span class={styles.label}>逾期提醒</span>
          </label>
          <label class={styles.field}>
            <span class={styles.label}>逾期提醒间隔（分钟）</span>
            <input
              class={styles.input}
              value={notifyDraft()!.notify_overdue_interval_minutes}
              onInput={(e) => setNotifyDraft((n) => n ? { ...n, notify_overdue_interval_minutes: e.currentTarget.value } : n)}
            />
          </label>
          <button
            class={`${styles.btn} ${styles.btnPrimary}`}
            style={{ 'margin-top': '8px' }}
            onClick={async () => {
              const n = notifyDraft()
              if (!n) return
              try {
                await updateNotificationSettings(n)
                pushToast('success', '通知设置已保存')
              } catch {
                pushToast('error', '保存失败')
              }
            }}
          >
            保存通知设置
          </button>
        </Show>
      </section>

      <section class={styles.section}>
        <p class={styles.sectionTitle}>节假日</p>
        <p class={styles.hint}>默认离线使用内置数据；仅在您确认后才会访问外网 API。</p>
        <p class={styles.holidayCount}>
          本地已缓存 <strong>{holidayCount() ?? '…'}</strong> 条记录（影响工作日判断与日程可用时长）
        </p>
        <button class={styles.btn} onClick={() => void syncHolidays()}>从网络同步当年节假日</button>
      </section>

      <section class={styles.section}>
        <p class={styles.sectionTitle}>数据与备份</p>
        <p class={styles.hint}>
          Docket 是本地优先应用，所有任务数据都在本机 SQLite 文件中。备份与迁移请直接复制该文件（建议先退出应用或复制后校验）。
          不需要 JSON 导入导出。
        </p>
        <div class={styles.pathRow}>
          <code class={styles.path}>{dbPath() ?? '…'}</code>
          <button class={styles.btn} onClick={() => void copyPath()} disabled={!dbPath()}>复制路径</button>
          <button class={styles.btn} onClick={() => void openFolder()}>打开所在文件夹</button>
        </div>
      </section>
    </div>
  )
}

export default SettingsPanel
