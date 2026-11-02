import { type Component, For, Show, createMemo } from 'solid-js'
import domain from '../DomainPage/DomainPage.module.css'
import listStyles from '../TaskList/TaskList.module.css'
import TaskCard from '../TaskCard/TaskCard'
import { AgendaRow } from '../AgendaList/AgendaList'
import {
  openFacet,
  categories,
  tags,
  agenda,
  overdueAgenda,
  tasks,
  matters,
  playbooks,
  searchQuery,
  selectTask,
  selectMatter,
  completeTaskFromList,
  completeMatterStep,
  reopenMatterStep,
  pushToast,
  invalidateAfterTaskMutation,
  refetchAgenda,
  refetchTasks,
  refetchMatters,
} from '../../stores'
import { filterAgendaItems } from '../../utils/agendaMap'
import { filterMatterSummaries, filterTaskSummaries } from '../../utils/facetFilter'
import { formatDue } from '../../utils/date'
import type { AgendaItem } from '../../bindings/types'
import styles from './FacetPage.module.css'

const STATUS: Record<string, string> = {
  active: '进行中',
  completed: '已办结',
  archived: '已归档',
}

const SectionError: Component<{ onRetry: () => void }> = (props) => (
  <div class={listStyles.error}>
    <p class={listStyles.errorText}>加载失败</p>
    <button type="button" class={listStyles.retryBtn} onClick={props.onRetry}>重试</button>
  </div>
)

const FacetPage: Component = () => {
  const facet = () => openFacet()
  const title = () => {
    const f = facet()
    if (!f) return ''
    if (f.type === 'category') {
      return (categories.latest ?? []).find((c) => c.id === f.id)?.name ?? ''
    }
    return (tags.latest ?? []).find((t) => t.id === f.id)?.name ?? ''
  }
  const lead = () =>
    facet()?.type === 'tag'
      ? '此标签下的今日安排、任务和事项。'
      : '此分类下的今日安排、任务和事项。'

  const agendaFilter = () => {
    const f = facet()
    return {
      search: searchQuery() ?? '',
      priority: null,
      categoryId: f?.type === 'category' ? f.id : null,
      tagId: f?.type === 'tag' ? f.id : null,
    }
  }
  const todayItems = createMemo(() => filterAgendaItems(agenda.latest ?? [], agendaFilter()))
  const overdueItems = createMemo(() => filterAgendaItems(overdueAgenda.latest ?? [], agendaFilter()))
  const agendaEmpty = () => todayItems().length === 0 && overdueItems().length === 0
  const agendaLoading = () => (agenda.loading ?? false) || (overdueAgenda.loading ?? false)
  const agendaFailed = () => Boolean(agenda.error || overdueAgenda.error)

  const needle = () => (searchQuery() ?? '').trim().toLowerCase()
  const facetTasks = createMemo(() => {
    const f = facet()
    if (!f) return []
    const q = needle()
    return filterTaskSummaries(tasks.latest ?? [], f).filter((t) => !q || t.title.toLowerCase().includes(q))
  })
  const facetMatters = createMemo(() => {
    const f = facet()
    if (!f) return []
    const q = needle()
    return filterMatterSummaries(matters.latest ?? [], f).filter((m) => !q || m.title.toLowerCase().includes(q))
  })

  const playbookTitle = (id: number | null) => {
    if (id == null) return '空白事项'
    return (playbooks.latest ?? []).find((p) => p.id === id)?.title ?? '模板'
  }

  const onAgendaToggle = (item: AgendaItem) => {
    if (item.kind === 'task') {
      void completeTaskFromList(item.id)
      return
    }
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

  const onAgendaClick = (item: AgendaItem) => {
    if (item.kind === 'task') selectTask(item.id)
    else if (item.matter_id != null) selectMatter(item.matter_id)
  }

  return (
    <div class={domain.container}>
      <h2 class={domain.title}>{title()}</h2>
      <p class={domain.lead}>{lead()}</p>

      <section class={styles.section} aria-label="今日">
        <h3 class={styles.heading}>今日</h3>
        <Show when={agendaFailed()}>
          <SectionError onRetry={refetchAgenda} />
        </Show>
        <Show when={!agendaFailed() && agendaLoading()}>
          <p class={styles.empty}>加载中…</p>
        </Show>
        <Show when={!agendaFailed() && !agendaLoading() && agendaEmpty()}>
          <p class={styles.empty}>没有此类条目</p>
        </Show>
        <Show when={!agendaFailed() && !agendaLoading() && !agendaEmpty()}>
          <div class={listStyles.list}>
            <Show when={overdueItems().length > 0}>
              <p class={listStyles.sectionLabel}>逾期</p>
              <For each={overdueItems()}>
                {(item) => <AgendaRow item={item} onToggle={onAgendaToggle} onClick={onAgendaClick} />}
              </For>
            </Show>
            <Show when={todayItems().length > 0}>
              <Show when={overdueItems().length > 0}>
                <p class={listStyles.sectionLabel}>今日</p>
              </Show>
              <For each={todayItems()}>
                {(item) => <AgendaRow item={item} onToggle={onAgendaToggle} onClick={onAgendaClick} />}
              </For>
            </Show>
          </div>
        </Show>
      </section>

      <section class={styles.section} aria-label="任务">
        <h3 class={styles.heading}>任务</h3>
        <Show when={tasks.error}>
          <SectionError onRetry={() => void refetchTasks()} />
        </Show>
        <Show when={!tasks.error && tasks.loading}>
          <p class={styles.empty}>加载中…</p>
        </Show>
        <Show when={!tasks.error && !tasks.loading && facetTasks().length === 0}>
          <p class={styles.empty}>没有此类条目</p>
        </Show>
        <Show when={!tasks.error && !tasks.loading && facetTasks().length > 0}>
          <div class={listStyles.list}>
            <For each={facetTasks()}>
              {(task) => (
                <div class={listStyles.taskRow}>
                  <TaskCard
                    task={task}
                    showCheckbox={true}
                    onToggle={(id) => void completeTaskFromList(id)}
                    onClick={(id) => selectTask(id)}
                  />
                </div>
              )}
            </For>
          </div>
        </Show>
      </section>

      <section class={styles.section} aria-label="事项">
        <h3 class={styles.heading}>事项</h3>
        <Show when={matters.error}>
          <SectionError onRetry={() => void refetchMatters()} />
        </Show>
        <Show when={!matters.error && matters.loading}>
          <p class={styles.empty}>加载中…</p>
        </Show>
        <Show when={!matters.error && !matters.loading && facetMatters().length === 0}>
          <p class={styles.empty}>没有此类条目</p>
        </Show>
        <Show when={!matters.error && !matters.loading && facetMatters().length > 0}>
          <div class={domain.list}>
            <For each={facetMatters()}>
              {(m) => (
                <button type="button" class={domain.card} onClick={() => selectMatter(m.id)}>
                  <div class={domain.cardTitle}>
                    {m.title}
                    <Show when={m.missing_evidence}>
                      <span class={domain.badge}>缺依据</span>
                    </Show>
                  </div>
                  <div class={domain.cardMeta}>
                    {STATUS[m.status] ?? m.status} · {playbookTitle(m.playbook_id)}
                    {m.current_step ? ` · 当前：${m.current_step.title}` : ''}
                    {m.due_date ? ` · ${formatDue(m.due_date)}` : ''}
                  </div>
                </button>
              )}
            </For>
          </div>
        </Show>
      </section>
    </div>
  )
}

export default FacetPage
