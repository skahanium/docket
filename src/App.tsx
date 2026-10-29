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
  scheduleDailyReviewCheck,
  completeTaskFromList,
  refetchTasks,
  refetchAgenda,
  invalidateAfterTaskMutation,
  agenda,
  activePriority,
  completeMatterStep,
  pushToast,
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

const Calendar = lazy(() => import('./components/Calendar/Calendar'))
const Schedule = lazy(() => import('./components/Schedule/Schedule'))
const StatsPanel = lazy(() => import('./components/StatsPanel/StatsPanel'))
const SettingsPanel = lazy(() => import('./components/SettingsPanel/SettingsPanel'))
const MatterList = lazy(() => import('./components/MatterList/MatterList'))
const PlaybookPage = lazy(() => import('./components/PlaybookPage/PlaybookPage'))
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
      if (mod && e.key === 'n') { e.preventDefault(); openDialog() }
      else if (mod && e.key === 'f') { e.preventDefault(); (document.querySelector<HTMLInputElement>('input[placeholder*="搜索"]'))?.focus() }
      else if (e.key === 'Escape') { deselectTask(); deselectMatter(); setDialogOpen(false); setReviewOpen(false) }
    }
    document.addEventListener('keydown', handleKey)
    const u1 = listen<string>('navigate', (e) => { if (e.payload === 'today') setActiveView('today') })
    const u2 = listen('quick-add', () => openDialog())
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

  const viewTitle = () => {
    switch (activeView?.() ?? 'all') {
      case 'today': return '今日调度'
      case 'overdue': return '逾期'
      case 'schedule': return '日程'
      case 'archive': return '归档'
      default: return '全部任务'
    }
  }

  return (
    <div style={{ display: 'flex', 'flex-direction': 'column', height: '100%' }}>
      <TopBar
        searchValue={searchQuery?.() ?? ''}
        onSearchInput={setSearchQuery}
        onCreateClick={() => openDialog()}
      />

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <Sidebar
          activeView={activeView?.() ?? 'all'}
          categories={categories?.() ?? []}
          tags={tags?.() ?? []}
          activeCategoryId={activeCategoryId()}
          activeTagId={activeTagId()}
          onViewChange={(v) => { setActiveView(v); deselectTask(); clearFilters() }}
          onCategorySelect={(id) => setActiveCategoryId(id)}
          onTagSelect={(id) => setActiveTagId(id)}
        />

        <main style={{ flex: 1, overflow: 'hidden' }}>
          <Switch>
            <Match when={(activeView?.() ?? 'all') === 'schedule'}>
              <Suspense fallback={<ViewLoading />}>
                <Schedule />
              </Suspense>
            </Match>
            <Match when={(activeView?.() ?? 'all') === 'calendar'}>
              <Suspense fallback={<ViewLoading />}>
                <Calendar onDoubleClickDate={(date) => openDialog(date)} />
              </Suspense>
            </Match>
            <Match when={(activeView?.() ?? 'all') === 'stats'}>
              <Suspense fallback={<ViewLoading />}>
                <StatsPanel />
              </Suspense>
            </Match>
            <Match when={(activeView?.() ?? 'all') === 'settings'}>
              <Suspense fallback={<ViewLoading />}>
                <SettingsPanel />
              </Suspense>
            </Match>
            <Match when={(activeView?.() ?? 'all') === 'matters'}>
              <Suspense fallback={<ViewLoading />}>
                <MatterList />
              </Suspense>
            </Match>
            <Match when={(activeView?.() ?? 'all') === 'playbooks'}>
              <Suspense fallback={<ViewLoading />}>
                <PlaybookPage />
              </Suspense>
            </Match>
            <Match when={(activeView?.() ?? 'all') === 'cadences'}>
              <Suspense fallback={<ViewLoading />}>
                <CadencePage />
              </Suspense>
            </Match>
            <Match when={(activeView?.() ?? 'all') === 'today' || (activeView?.() ?? 'all') === 'overdue'}>
              <AgendaList
                title={viewTitle()}
                items={filterAgendaItems(agenda() ?? [], { search: searchQuery() ?? '', priority: activePriority() })}
                loading={agenda?.loading ?? false}
                error={agenda?.error ? String(agenda.error) : null}
                onToggle={(item) => {
                  if (item.kind === 'task') void completeTaskFromList(item.id)
                  else {
                    void completeMatterStep(item.id)
                      .then(() => {
                        pushToast('success', '已完成当前步')
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
                title={viewTitle()}
                tasks={tasks ? (tasks() ?? []) : []}
                loading={tasks?.loading ?? false}
                error={tasks?.error ? String(tasks.error) : null}
                categories={categories?.() ?? []}
                tags={tags?.() ?? []}
                showFilters={(activeView?.() ?? 'all') !== 'archive'}
                isArchive={(activeView?.() ?? 'all') === 'archive'}
                onCategoryChange={(id) => setActiveCategoryId(id)}
                onTagChange={(id) => setActiveTagId(id)}
                onClearFilters={clearFilters}
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
              {t.message}
            </div>
          }}
        </For>
      </div>
    </div>
  )
}

export default App
