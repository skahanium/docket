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
      matters: Array<Record<string, unknown>>
    }
  }
}

/**
 * Inject a fixture-backed `window.__TAURI_INTERNALS__` before app scripts run,
 * so the full UI boots under `vite dev` without a Tauri runtime.
 *
 * Static commands answer from `fixtures`; a small mutable world backs the
 * matter golden path (create_matter / complete_matter_step / get_matter), with
 * `list_agenda` / `list_matters` returning static rows merged with derived ones.
 */
export async function bootApp(page: Page, overrides: FixtureData = {}): Promise<void> {
  await page.addInitScript(
    ({ defaults, over }) => {
      type Step = { id: number; title: string; sort_order: number; optional: boolean; evidence_required: boolean; estimated_minutes: number | null; status: string; due_date: string | null; links: unknown[] }
      type Matter = { id: number; playbook_id: number | null; title: string; status: string; priority: number; category_id: number | null; due_date: string | null; created_at: string; updated_at: string; completed_at: string | null; notes: string | null; tags: unknown[]; steps: Step[] }

      const state = {
        commands: [] as string[],
        deletedTagIds: [] as number[],
        matters: [] as Matter[],
      }
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
      let seq = 1000

      const staticList = (key: string): unknown[] =>
        Array.isArray(fixtures[key]) ? (fixtures[key] as unknown[]) : []

      const currentStep = (m: Matter) =>
        m.steps.filter((s) => s.status === 'pending').sort((a, b) => a.sort_order - b.sort_order)[0] ?? null

      const derivedAgenda = () =>
        state.matters
          .filter((m) => m.status === 'active')
          .map((m) => {
            const s = currentStep(m)
            if (!s) return null
            return {
              kind: 'matter_step',
              id: s.id,
              title: s.title,
              subtitle: m.title,
              due_date: s.due_date ?? m.due_date,
              priority: m.priority,
              matter_id: m.id,
              missing_evidence: s.evidence_required,
              category_id: m.category_id,
              tag_ids: [],
            }
          })
          .filter(Boolean)

      const derivedMatters = () =>
        state.matters.map((m) => {
          const s = currentStep(m)
          return {
            id: m.id,
            playbook_id: m.playbook_id,
            title: m.title,
            status: m.status,
            priority: m.priority,
            category_id: m.category_id,
            due_date: m.due_date,
            created_at: m.created_at,
            completed_at: m.completed_at,
            tags: [],
            current_step: s
              ? { id: s.id, title: s.title, sort_order: s.sort_order, evidence_required: s.evidence_required, status: s.status, due_date: s.due_date }
              : null,
            missing_evidence: !!s && s.evidence_required,
          }
        })

      const handlers: Record<string, (args?: Record<string, unknown>) => unknown> = {
        // 可变世界：事项主线推进
        create_matter: (args) => {
          const input = (args?.input ?? args) as {
            playbook_id: number
            title: string
            priority?: number
            due_date?: string | null
            category_id?: number | null
          }
          const pbs = staticList('list_playbooks') as Array<{ id: number; steps: Array<Record<string, unknown>> }>
          const pb = pbs.find((p) => p.id === input.playbook_id)
          const now = new Date().toISOString()
          const matter: Matter = {
            id: ++seq,
            playbook_id: input.playbook_id ?? null,
            title: input.title,
            status: 'active',
            priority: input.priority ?? 0,
            category_id: input.category_id ?? null,
            due_date: input.due_date ?? null,
            created_at: now,
            updated_at: now,
            completed_at: null,
            notes: null,
            tags: [],
            steps: (pb?.steps ?? []).map((s, i) => ({
              id: seq * 10 + i,
              title: s.title as string,
              sort_order: i,
              optional: false,
              evidence_required: !!s.evidence_required,
              estimated_minutes: (s.estimated_minutes as number | null) ?? null,
              status: 'pending',
              due_date: null,
              links: [],
            })),
          }
          state.matters.push(matter)
          return matter.id
        },
        complete_matter_step: (args) => {
          const stepId = Number(args?.stepId)
          for (const m of state.matters) {
            const s = m.steps.find((x) => x.id === stepId)
            if (s) {
              s.status = 'completed'
              if (m.steps.every((x) => x.status !== 'pending')) {
                m.status = 'completed'
                m.completed_at = new Date().toISOString()
              }
              return undefined
            }
          }
          return undefined
        },
        get_matter: (args) => {
          const id = Number(args?.id)
          const m = state.matters.find((x) => x.id === id)
          if (!m) return null
          const s = currentStep(m)
          return {
            ...m,
            current_step: s
              ? { id: s.id, title: s.title, sort_order: s.sort_order, evidence_required: s.evidence_required, status: s.status, due_date: s.due_date }
              : null,
          }
        },
        list_agenda: (args) => {
          // 逾期段为空；今日段 = 静态行 + 世界派生行
          if (args?.view === 'overdue') return []
          return [...staticList('list_agenda'), ...derivedAgenda()]
        },
        list_matters: () => [...staticList('list_matters'), ...derivedMatters()],
      }

      const invoke = async (cmd: string, args?: Record<string, unknown>) => {
        state.commands.push(cmd)
        if (cmd === 'plugin:window|is_visible') return true
        if (cmd === 'plugin:event|listen') return 1
        if (cmd === 'plugin:event|unlisten') return undefined
        if (cmd.startsWith('plugin:')) return 1
        if (cmd === 'delete_tag') {
          state.deletedTagIds.push(Number((args as { id?: number })?.id ?? 0))
          return undefined
        }
        if (handlers[cmd]) return handlers[cmd](args)
        if (Object.prototype.hasOwnProperty.call(fixtures, cmd)) return fixtures[cmd]
        console.warn('[e2e] unmocked command:', cmd, args)
        return null
      }

      const callbacks = new Map<number, (...a: unknown[]) => unknown>()
      let cbSeq = 1
      ;(window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {
        invoke,
        metadata: {
          currentWindow: { label: 'main' },
          windows: [{ label: 'main' }],
        },
        transformCallback(cb: (...a: unknown[]) => unknown) {
          const id = cbSeq++
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
