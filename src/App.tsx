import { type Component, Switch, Match, Show, createSignal, onMount, onCleanup, For, lazy, Suspense } from 'solid-js'
import { listen } from '@tauri-apps/api/event'
import {
  activeView, setActiveView,
  categories, tags, tasks,
  activeCategoryId, setActiveCategoryId,
  activeTagId, setActiveTagId,
  searchQuery, setSearchQuery,
  selectTask, deselectTask, selectMatter, deselectMatter,
  toasts,
  clearFilters,
  reviewOpen,
  setReviewOpen,
  settingsOpen,
  setSettingsOpen,
  scheduleDailyReviewCheck,
  completeTaskFromList,
  refetchTasks,
  refetchAgenda,
  invalidateAfterTaskMutation,
  agenda,
  overdueAgenda,
  activePriority,
  completeMatterStep,
  reopenMatterStep,
  pushToast,
  dismissToast,
} from './stores'
import { filterAgendaItems } from './utils/agendaMap'
import TopBar from './components/TopBar/TopBar'
import Sidebar from './components/Sidebar/Sidebar'
import TaskList from './components/TaskList/TaskList'
import CreateTaskDialog from './components/CreateTaskDialog/CreateTaskDialog'
import TaskDetail from './components/TaskDetail/TaskDetail'
import DailyReviewDialog from './components/DailyReview/DailyReviewDialog'
import AgendaList from './components/AgendaList/AgendaList'
import MatterDetail from './components/MatterDetail/MatterDetail'
import SettingsOverlay from './components/SettingsOverlay/SettingsOverlay'
import shell from './App.module.css'

const Calendar = lazy(() => import('./components/Calendar/Calendar'))
const StatsPanel = lazy(() => import('./components/StatsPanel/StatsPanel'))
const MatterList = lazy(() => import('./components/MatterList/MatterList'))
const CadencePage = lazy(() => import('./components/CadencePage/CadencePage'))

const ViewLoading: Component = () => (
  <div style={{ padding: '24px', color: 'var(--text-sub)', 'font-size': '14px' }}>加载视图…</div>
)

const App: Component = () => {
  const [dialogOpen, setDialogOpen] = createSignal(false)
  const [dialogDueDate, setDialogDueDate] = createSignal<string | undefined>(undefined)

  const openDialog = (dueDate?: string) => {
    setDialogDueDate(dueDate)
    setDialogOpen(true)
  }

  onMount(() => {
    const handleKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey
      if (settingsOpen()) {
        if (e.key === 'Escape') { e.preventDefault(); setSettingsOpen(false) }
        if (mod && (e.key === 'n' || e.key === 'f')) e.preventDefault()
        return
      }
      if (mod && e.key === 'n') { e.preventDefault(); openDialog() }
      else if (mod && e.key === 'f') { e.preventDefault(); (document.querySelector<HTMLInputElement>('input[placeholder*="搜索"]'))?.focus() }
      else if (e.key === 'Escape') {
        if (dialogOpen() || reviewOpen()) { setDialogOpen(false); setReviewOpen(false); return }
        deselectTask()
        deselectMatter()
      }
    }
    document.addEventListener('keydown', handleKey)
    const u1 = listen<string>('navigate', (e) => {
      if (e.payload === 'today') {
        clearFilters()
        setActiveView('today')
      }
    })
    const u2 = listen('quick-add', () => { if (!settingsOpen()) openDialog() })
    const u3 = listen<number>('open-task', (e) => {
      clearFilters()
      setActiveView('today')
      selectTask(e.payload)
    })
    const u4 = listen<number>('open-matter', (e) => {
      clearFilters()
      setActiveView('today')
      selectMatter(e.payload)
    })
    const u5 = listen('tasks-changed', () => invalidateAfterTaskMutation())
    onCleanup(() => {
      document.removeEventListener('keydown', handleKey)
      u1.then(fn => fn())
      u2.then(fn => fn())
      u3.then(fn => fn())
      u4.then(fn => fn())
      u5.then(fn => fn())
    })

    scheduleDailyReviewCheck()
  })

  const handleToggle = (id: number) => {
    void completeTaskFromList(id)
  }

  const agendaFilter = () => ({
    search: searchQuery() ?? '',
    priority: activePriority(),
    categoryId: activeCategoryId(),
    tagId: activeTagId(),
  })

  return (
    <div class={shell.root}>
      <div
        class={shell.chrome}
        inert={settingsOpen() || undefined}
      >
        <TopBar
          searchValue={searchQuery?.() ?? ''}
          onSearchInput={setSearchQuery}
          onCreateClick={() => openDialog()}
        />

        <div class={shell.body}>
          <Sidebar
            activeView={activeView?.() ?? 'today'}
            categories={categories?.() ?? []}
            tags={tags?.() ?? []}
            activeCategoryId={activeCategoryId()}
            activeTagId={activeTagId()}
            settingsOpen={settingsOpen()}
            onViewChange={(v) => { setActiveView(v); deselectTask(); deselectMatter(); clearFilters() }}
            onCategorySelect={(id) => setActiveCategoryId(id)}
            onTagSelect={(id) => setActiveTagId(id)}
            onSettingsClick={() => setSettingsOpen(true)}
          />

          <main class={shell.main}>
            <Switch>
              <Match when={(activeView?.() ?? 'today') === 'calendar'}>
                <Suspense fallback={<ViewLoading />}>
                  <Calendar onDoubleClickDate={(date) => openDialog(date)} />
                </Suspense>
              </Match>
              <Match when={(activeView?.() ?? 'today') === 'progress'}>
                <Suspense fallback={<ViewLoading />}>
                  <div class={shell.progressScroll}>
                    <StatsPanel />
                    <CadencePage stacked />
                  </div>
                </Suspense>
              </Match>
              <Match when={(activeView?.() ?? 'today') === 'matters'}>
                <Suspense fallback={<ViewLoading />}>
                  <MatterList />
                </Suspense>
              </Match>
              <Match when={(activeView?.() ?? 'today') === 'today'}>
                <AgendaList
                  title="今日"
                  overdueItems={filterAgendaItems(overdueAgenda() ?? [], agendaFilter())}
                  items={filterAgendaItems(agenda() ?? [], agendaFilter())}
                  loading={(agenda?.loading ?? false) || (overdueAgenda?.loading ?? false)}
                  error={
                    agenda?.error
                      ? String(agenda.error)
                      : overdueAgenda?.error
                        ? String(overdueAgenda.error)
                        : null
                  }
                  onToggle={(item) => {
                    if (item.kind === 'task') void completeTaskFromList(item.id)
                    else {
                      void completeMatterStep(item.id)
                        .then(() => {
                          pushToast('success', '已完成当前步', {
                            label: '撤销',
                            onClick: () => {
                              void reopenMatterStep(item.id)
                                .then(() => invalidateAfterTaskMutation())
                                .catch((e) => pushToast('error', String(e)))
                            },
                          })
                          invalidateAfterTaskMutation()
                        })
                        .catch((e) => pushToast('error', String(e)))
                    }
                  }}
                  onClick={(item) => {
                    if (item.kind === 'task') selectTask(item.id)
                    else if (item.matter_id != null) selectMatter(item.matter_id)
                  }}
                  onRetry={refetchAgenda}
                />
              </Match>
              <Match when={true}>
                <TaskList
                  title="任务"
                  tasks={tasks ? (tasks() ?? []) : []}
                  loading={tasks?.loading ?? false}
                  error={tasks?.error ? String(tasks.error) : null}
                  onTaskToggle={handleToggle}
                  onTaskClick={(id) => selectTask(id)}
                  onRetry={refetchTasks}
                />
              </Match>
            </Switch>
          </main>
        </div>

        <TaskDetail />
        <MatterDetail />
        <Show when={dialogOpen()}>
          <CreateTaskDialog open={true} defaultDueDate={dialogDueDate()} onClose={() => setDialogOpen(false)} />
        </Show>
        <DailyReviewDialog open={reviewOpen()} onClose={() => setReviewOpen(false)} />
      </div>

      <Show when={settingsOpen()}>
        <SettingsOverlay onClose={() => setSettingsOpen(false)} />
      </Show>

      <div role="status" aria-live="polite" style={{ position: 'fixed', top: '16px', right: '16px', 'z-index': '999', display: 'flex', 'flex-direction': 'column', gap: '10px' }}>
        <For each={toasts?.() ?? []}>
          {(t) => {
            const borderColor = t.type === 'error' ? 'var(--danger)' : t.type === 'success' ? 'var(--success)' : 'var(--accent)'
            return <div style={{
              background: 'color-mix(in srgb, var(--bg-elevated) 90%, transparent)', border: '1px solid var(--border)',
              'border-radius': 'var(--radius-xl)', padding: '14px 20px',
              'font-size': '15px', color: 'var(--text-main)',
              'box-shadow': 'var(--shadow-lg)', 'max-width': '360px',
              'backdrop-filter': 'blur(12px)', '-webkit-backdrop-filter': 'blur(12px)',
              animation: 'toast-in 250ms cubic-bezier(0.16, 1, 0.3, 1) both',
              'border-left': `3px solid ${borderColor}`,
              display: 'flex', 'align-items': 'center', gap: '10px',
            }}>
              <span style={{ color: borderColor, 'font-size': '18px', 'flex-shrink': 0 }}>
                {t.type === 'error' ? '✕' : t.type === 'success' ? '✓' : 'i'}
              </span>
              <span>{t.message}</span>
              <Show when={t.action}>
                <button
                  type="button"
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--accent)',
                    'font-size': '14px',
                    cursor: 'pointer',
                    'flex-shrink': 0,
                  }}
                  onClick={() => {
                    t.action?.onClick()
                    dismissToast(t.id)
                  }}
                >{t.action!.label}</button>
              </Show>
            </div>
          }}
        </For>
      </div>
    </div>
  )
}

export default App
