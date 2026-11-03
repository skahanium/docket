import { type Component, Show, createResource, createSignal, createEffect } from 'solid-js'
import styles from './SettingsPanel.module.css'
import type { Settings } from '../../bindings/types'
import {
  getSettings,
  updateSettings,
  listHolidays,
  fetchHolidaysOnline,
  getDatabasePath,
  backupDatabase,
  revealDatabaseFolder,
  getNotificationSettings,
  updateNotificationSettings,
  pushToast,
  themeMode,
  setThemeMode,
  type ThemeMode,
} from '../../stores'
import type { NotificationSettings } from '../../bindings/notifications'
import {
  getPanelSettings,
  updatePanelSettings,
  type PanelSettings,
} from '../../bindings/panel'
import { isMacOS } from '../../utils/platform'

export type SettingsPage =
  | 'general'
  | 'runtime'
  | 'categories'
  | 'tags'
  | 'playbooks'
  | 'data'

const THEME_OPTIONS: { key: ThemeMode; label: string }[] = [
  { key: 'light', label: '日间' },
  { key: 'dark', label: '夜间' },
  { key: 'system', label: '跟随系统' },
]

interface Props {
  page: SettingsPage
}

const SettingsPanel: Component<Props> = (props) => {
  const [loaded] = createResource(getSettings)
  const [draft, setDraft] = createSignal<Settings | null>(null)
  const [saving, setSaving] = createSignal(false)
  const [dbPath] = createResource(getDatabasePath)
  const [holidayCount, { refetch: refetchHolidayCount }] = createResource(
    async () => (await listHolidays()).length,
  )
  const [notifyLoaded] = createResource(getNotificationSettings)
  const [notifyDraft, setNotifyDraft] = createSignal<NotificationSettings | null>(null)
  const [notifySaved, setNotifySaved] = createSignal<NotificationSettings | null>(null)
  const [panelLoaded] = createResource(getPanelSettings)
  const [panelDraft, setPanelDraft] = createSignal<PanelSettings | null>(null)
  const [panelSaved, setPanelSaved] = createSignal<PanelSettings | null>(null)

  createEffect(() => {
    const n = notifyLoaded()
    if (n) {
      setNotifyDraft({ ...n })
      setNotifySaved({ ...n })
    }
  })

  createEffect(() => {
    const s = loaded()
    if (s) setDraft({ ...s })
  })

  createEffect(() => {
    const p = panelLoaded()
    if (p) {
      setPanelDraft({ ...p })
      setPanelSaved({ ...p })
    }
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

  // 开关自动保存：以已保存快照为基座合并单字段，不吞未保存的表单草稿
  const patchNotifyToggle = async (patch: Partial<NotificationSettings>) => {
    const base = notifySaved()
    if (!base) return
    const next = { ...base, ...patch }
    setNotifyDraft((d) => (d ? { ...d, ...patch } : d))
    setNotifySaved(next)
    try {
      await updateNotificationSettings(next)
      pushToast('success', '已保存')
    } catch {
      pushToast('error', '保存失败')
    }
  }

  const saveNotify = async () => {
    const n = notifyDraft()
    if (!n) return
    try {
      await updateNotificationSettings(n)
      setNotifySaved({ ...n })
      pushToast('success', '通知设置已保存')
    } catch {
      pushToast('error', '保存失败')
    }
  }

  const patchPanelToggle = async (patch: Partial<PanelSettings>) => {
    const base = panelSaved()
    if (!base) return
    const next = { ...base, ...patch }
    setPanelDraft((d) => (d ? { ...d, ...patch } : d))
    setPanelSaved(next)
    try {
      await updatePanelSettings(next)
      pushToast('success', '已保存')
    } catch {
      pushToast('error', '保存失败')
    }
  }

  const savePanel = async () => {
    const p = panelDraft()
    if (!p) return
    try {
      await updatePanelSettings(p)
      setPanelSaved({ ...p })
      pushToast('success', '面板设置已保存')
    } catch {
      pushToast('error', '保存失败')
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

  const backup = async () => {
    try {
      const saved = await backupDatabase()
      if (saved) pushToast('success', '已备份到 ' + saved)
    } catch (e) {
      pushToast('error', `备份失败: ${e}`)
    }
  }

  const patch = (key: keyof Settings, value: string) => {
    const s = draft()
    if (!s) return
    setDraft({ ...s, [key]: value })
  }

  return (
    <div class={styles.page}>
      <Show when={props.page === 'general'}>
        <h2 class={styles.pageTitle}>常规</h2>
        <p class={styles.lead}>外观、工作时间与节假日。开关即时保存；带校验的字段需点「保存」。</p>

        <section class={styles.card}>
          <div class={styles.cardHead}>
            <p class={styles.cardTitle}>外观</p>
            <p class={styles.cardHint}>跟随系统时随 macOS 外观变化。</p>
          </div>
          <div class={styles.themeRow}>
            {THEME_OPTIONS.map((opt) => (
              <button
                type="button"
                class={`${styles.btn} ${themeMode() === opt.key ? styles.btnPrimary : ''}`}
                onClick={() => setThemeMode(opt.key)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </section>

        <section class={styles.card}>
          <div class={styles.cardHead}>
            <p class={styles.cardTitle}>工作时间</p>
            <p class={styles.cardHint}>决定日程排程的可用时长。</p>
          </div>
          <Show when={draft()} fallback={<p class={styles.cardHint}>加载中…</p>}>
            <div class={styles.row}>
              <div class={styles.rowText}>
                <span class={styles.rowLabel}>上午</span>
              </div>
              <div class={styles.rowControl}>
                <div class={styles.times}>
                  <input
                    class={styles.input}
                    value={draft()!.work_start_am}
                    onInput={(e) => patch('work_start_am', e.currentTarget.value)}
                  />
                  <span class={styles.dash}>–</span>
                  <input
                    class={styles.input}
                    value={draft()!.work_end_am}
                    onInput={(e) => patch('work_end_am', e.currentTarget.value)}
                  />
                </div>
              </div>
            </div>
            <div class={styles.row}>
              <div class={styles.rowText}>
                <span class={styles.rowLabel}>下午</span>
              </div>
              <div class={styles.rowControl}>
                <div class={styles.times}>
                  <input
                    class={styles.input}
                    value={draft()!.work_start_pm}
                    onInput={(e) => patch('work_start_pm', e.currentTarget.value)}
                  />
                  <span class={styles.dash}>–</span>
                  <input
                    class={styles.input}
                    value={draft()!.work_end_pm}
                    onInput={(e) => patch('work_end_pm', e.currentTarget.value)}
                  />
                </div>
              </div>
            </div>
            <div class={styles.row}>
              <div class={styles.rowText}>
                <span class={styles.rowLabel}>默认专注</span>
                <span class={styles.rowHint}>分钟</span>
              </div>
              <div class={styles.rowControl}>
                <div class={styles.num}>
                  <input
                    class={styles.input}
                    value={draft()!.default_focus_minutes}
                    onInput={(e) => patch('default_focus_minutes', e.currentTarget.value)}
                  />
                </div>
              </div>
            </div>
            <div class={styles.cardFooter}>
              <button
                class={`${styles.btn} ${styles.btnPrimary}`}
                disabled={saving()}
                onClick={() => void save()}
              >
                {saving() ? '保存中…' : '保存'}
              </button>
            </div>
          </Show>
        </section>

        <section class={styles.card}>
          <div class={styles.cardHead}>
            <p class={styles.cardTitle}>节假日</p>
            <p class={styles.cardHint}>
              默认离线使用内置数据；仅在您确认后才会访问外网 API。影响工作日判断与日程可用时长。
            </p>
          </div>
          <div class={styles.row}>
            <div class={styles.rowText}>
              <span class={styles.rowLabel}>本地缓存</span>
              <span class={styles.rowHint}>{holidayCount() ?? '…'} 条记录</span>
            </div>
            <div class={styles.rowControl}>
              <button class={styles.btn} onClick={() => void syncHolidays()}>
                从网络同步当年节假日
              </button>
            </div>
          </div>
        </section>
      </Show>

      <Show when={props.page === 'runtime'}>
        <h2 class={styles.pageTitle}>提醒与面板</h2>
        <p class={styles.lead}>本地通知与桌面任务面板。开关即时保存；时间字段需点「保存」。</p>

        <section class={styles.card}>
          <div class={styles.cardHead}>
            <p class={styles.cardTitle}>通知</p>
          </div>
          <Show when={notifyDraft()} fallback={<p class={styles.cardHint}>加载中…</p>}>
            <div class={styles.row}>
              <div class={styles.rowText}>
                <span class={styles.rowLabel}>每日摘要</span>
                <span class={styles.rowHint}>本地通知</span>
              </div>
              <div class={styles.rowControl}>
                <label class={styles.checkRow} aria-label="每日摘要">
                  <input
                    type="checkbox"
                    checked={notifyDraft()!.notify_daily_summary}
                    onChange={(e) => void patchNotifyToggle({ notify_daily_summary: e.currentTarget.checked })}
                  />
                </label>
              </div>
            </div>
            <div class={styles.row}>
              <div class={styles.rowText}>
                <span class={styles.rowLabel}>摘要时间</span>
                <span class={styles.rowHint}>HH:MM</span>
              </div>
              <div class={styles.rowControl}>
                <div class={styles.times}>
                  <input
                    class={styles.input}
                    value={notifyDraft()!.notify_daily_time}
                    onInput={(e) => setNotifyDraft((n) => (n ? { ...n, notify_daily_time: e.currentTarget.value } : n))}
                  />
                </div>
              </div>
            </div>
            <div class={styles.row}>
              <div class={styles.rowText}>
                <span class={styles.rowLabel}>逾期提醒</span>
              </div>
              <div class={styles.rowControl}>
                <label class={styles.checkRow} aria-label="逾期提醒">
                  <input
                    type="checkbox"
                    checked={notifyDraft()!.notify_overdue}
                    onChange={(e) => void patchNotifyToggle({ notify_overdue: e.currentTarget.checked })}
                  />
                </label>
              </div>
            </div>
            <div class={styles.row}>
              <div class={styles.rowText}>
                <span class={styles.rowLabel}>逾期提醒间隔</span>
                <span class={styles.rowHint}>分钟</span>
              </div>
              <div class={styles.rowControl}>
                <div class={styles.num}>
                  <input
                    class={styles.input}
                    value={notifyDraft()!.notify_overdue_interval_minutes}
                    onInput={(e) => setNotifyDraft((n) => (n ? { ...n, notify_overdue_interval_minutes: e.currentTarget.value } : n))}
                  />
                </div>
              </div>
            </div>
            <div class={styles.cardFooter}>
              <button class={`${styles.btn} ${styles.btnPrimary}`} onClick={() => void saveNotify()}>
                保存通知设置
              </button>
            </div>
          </Show>
        </section>

        <section class={styles.card}>
          <div class={styles.cardHead}>
            <p class={styles.cardTitle}>桌面任务面板</p>
          </div>
          <Show when={panelDraft()} fallback={<p class={styles.cardHint}>加载中…</p>}>
            <div class={styles.row}>
              <div class={styles.rowText}>
                <span class={styles.rowLabel}>窗口置顶</span>
                <span class={styles.rowHint}>关闭后可被其它窗口遮挡</span>
              </div>
              <div class={styles.rowControl}>
                <label class={styles.checkRow} aria-label="窗口置顶">
                  <input
                    type="checkbox"
                    checked={panelDraft()!.panel_always_on_top}
                    onChange={(e) => void patchPanelToggle({ panel_always_on_top: e.currentTarget.checked })}
                  />
                </label>
              </div>
            </div>
            <Show when={!isMacOS()}>
              <div class={styles.row}>
                <div class={styles.rowText}>
                  <span class={styles.rowLabel}>不透明背景</span>
                  <span class={styles.rowHint}>关闭毛玻璃，适合老机器</span>
                </div>
                <div class={styles.rowControl}>
                  <label class={styles.checkRow} aria-label="不透明背景">
                    <input
                      type="checkbox"
                      checked={panelDraft()!.panel_opaque}
                      onChange={(e) => void patchPanelToggle({ panel_opaque: e.currentTarget.checked })}
                    />
                  </label>
                </div>
              </div>
            </Show>
            <div class={styles.row}>
              <div class={styles.rowText}>
                <span class={styles.rowLabel}>可见时刷新间隔</span>
                <span class={styles.rowHint}>秒，30–600</span>
              </div>
              <div class={styles.rowControl}>
                <div class={styles.num}>
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
                </div>
              </div>
            </div>
            <div class={styles.cardFooter}>
              <button class={`${styles.btn} ${styles.btnPrimary}`} onClick={() => void savePanel()}>
                保存面板设置
              </button>
            </div>
          </Show>
        </section>
      </Show>

      <Show when={props.page === 'data'}>
        <h2 class={styles.pageTitle}>数据</h2>
        <p class={styles.lead}>Docket 是本地优先应用，所有数据都在本机 SQLite 文件中。</p>

        <section class={styles.card}>
          <div class={styles.cardHead}>
            <p class={styles.cardTitle}>数据与备份</p>
            <p class={styles.cardHint}>
              备份与迁移可一键存快照（VACUUM INTO，含 WAL 内容），或直接复制该文件；建议先退出应用或复制后校验。每天首次启动会自动备份一份到数据目录下的 backups/，保留最近 14 份；不含事项依据指向的卷宗文件，不需要 JSON 导入导出。
            </p>
          </div>
          <code class={styles.path} title={dbPath() ?? ''}>
            {dbPath() ?? '…'}
          </code>
          <div class={styles.actions}>
            <button class={styles.btn} onClick={() => void copyPath()} disabled={!dbPath()}>
              复制路径
            </button>
            <button class={styles.btn} onClick={() => void openFolder()}>
              打开所在文件夹
            </button>
            <button class={styles.btn} onClick={() => void backup()}>
              备份到…
            </button>
          </div>
        </section>
      </Show>
    </div>
  )
}

export default SettingsPanel
