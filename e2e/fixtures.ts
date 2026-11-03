import type { Page } from '@playwright/test'

/** Command → canned response for the injected Tauri invoke router. */
export type FixtureData = Record<string, unknown>

export const defaultFixtures: FixtureData = {
  list_categories: [
    { id: 1, name: '工作', color: '#0070F3', parent_id: null },
    { id: 2, name: '个人', color: '#0F7B6C', parent_id: null },
  ],
  list_tags: [
    { id: 1, name: '手测标签', color: '#7C3AED' },
    { id: 2, name: '临时标签', color: '#DFAB01' },
  ],
  list_tasks: [],
  list_agenda: [],
  list_matters: [],
  list_playbooks: [
    {
      id: 1,
      title: '手测模板',
      archived_at: null,
      steps: [
        { id: 11, playbook_id: 1, title: '依据步', sort_order: 0, optional: false, evidence_required: true, estimated_minutes: null },
        { id: 12, playbook_id: 1, title: '第二步', sort_order: 1, optional: false, evidence_required: false, estimated_minutes: null },
      ],
    },
  ],
  list_cadences: [],
  get_stats_panel: {
    statistics: { today_count: 0, overdue_count: 0, weekly_completion_rate: 0, daily_counts: [] },
    weekly_accuracy: { days: [], overall_accuracy: 0 },
    focus_heatmap: [],
  },
  get_settings: {
    work_start_am: '08:30',
    work_end_am: '12:00',
    work_start_pm: '14:30',
    work_end_pm: '18:00',
    default_focus_minutes: '45',
  },
  get_notification_settings: {
    notify_daily_summary: true,
    notify_daily_time: '08:00',
    notify_overdue: true,
    notify_overdue_interval_minutes: '60',
  },
  get_panel_settings: {
    panel_always_on_top: false,
    panel_opaque: false,
    panel_refresh_seconds: 120,
  },
  list_holidays: [],
  get_database_path: '/tmp/docket-e2e/docket.db',
  is_workday: true,
}

declare global {
  interface Window {
    __E2E_STATE__?: {
      commands: string[]
      deletedTagIds: number[]
    }
  }
}

/**
 * Inject a fixture-backed `window.__TAURI_INTERNALS__` before app scripts run,
 * so the full UI boots under `vite dev` without a Tauri runtime.
 */
export async function bootApp(page: Page, overrides: FixtureData = {}): Promise<void> {
  await page.addInitScript(
    ({ defaults, over }) => {
      const state = { commands: [] as string[], deletedTagIds: [] as number[] }
      ;(window as unknown as { __E2E_STATE__: typeof state }).__E2E_STATE__ = state

      // 关掉每日复盘自动弹窗，保证测试确定性
      const d = new Date()
      const pad = (n: number) => String(n).padStart(2, '0')
      const localDay = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
      try {
        localStorage.setItem(`docket-review-shown-${localDay}`, '1')
      } catch {
        /* ignore */
      }

      const fixtures: Record<string, unknown> = { ...defaults, ...over }

      const invoke = async (cmd: string, args?: Record<string, unknown>) => {
        state.commands.push(cmd)
        if (cmd === 'plugin:event|listen') return 1
        if (cmd === 'plugin:event|unlisten') return undefined
        if (cmd === 'delete_tag') {
          state.deletedTagIds.push(Number((args as { id?: number })?.id ?? 0))
          return undefined
        }
        if (Object.prototype.hasOwnProperty.call(fixtures, cmd)) return fixtures[cmd]
        console.warn('[e2e] unmocked command:', cmd, args)
        return null
      }

      const callbacks = new Map<number, (...a: unknown[]) => unknown>()
      let seq = 1
      ;(window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {
        invoke,
        transformCallback(cb: (...a: unknown[]) => unknown) {
          const id = seq++
          callbacks.set(id, cb)
          return id
        },
        unregisterCallback(id: number) {
          callbacks.delete(id)
        },
        convertFileSrc: (p: string) => p,
      }
    },
    { defaults: defaultFixtures, over: overrides },
  )
  await page.goto('/')
}
