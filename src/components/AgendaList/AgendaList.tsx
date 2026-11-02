import { type Component, For, Show } from 'solid-js'
import listStyles from '../TaskList/TaskList.module.css'
import cardStyles from '../TaskCard/TaskCard.module.css'
import Checkbox from '../shared/Checkbox'
import type { AgendaItem } from '../../bindings/types'
import { agendaRowCopy } from '../../utils/agendaMap'
import { formatDue, isOverdueDue } from '../../utils/date'
import { encodeDueDrag } from '../../utils/dueDrag'

interface Props {
  title: string
  items: AgendaItem[]
  overdueItems?: AgendaItem[]
  loading: boolean
  error: string | null
  onToggle: (item: AgendaItem) => void
  onClick: (item: AgendaItem) => void
  onRetry: () => void
}

export const AgendaRow: Component<{
  item: AgendaItem
  onToggle: (item: AgendaItem) => void
  onClick: (item: AgendaItem) => void
}> = (props) => {
  const copy = () => agendaRowCopy(props.item)
  const overdueRow = () => isOverdueDue(props.item.due_date)
  return (
    <div class={listStyles.taskRow}>
      <div
        class={`${cardStyles.card} ${overdueRow() ? cardStyles.cardOverdue : ''}`}
        role="button"
        tabindex={0}
        draggable={true}
        onDragStart={(e) => {
          e.dataTransfer?.setData('text/plain', encodeDueDrag({
            kind: props.item.kind === 'task' ? 'task' : 'matter_step',
            id: props.item.id,
            due: props.item.due_date,
          }))
          if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move'
        }}
        onClick={() => props.onClick(props.item)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            props.onClick(props.item)
          }
        }}
      >
        <Checkbox
          checked={false}
          onClick={(e) => {
            e.stopPropagation()
            props.onToggle(props.item)
          }}
        />
        <div class={cardStyles.body}>
          <div class={cardStyles.titleRow}>
            <span class={cardStyles.title}>{copy().title}</span>
            <Show when={props.item.missing_evidence}>
              <span class={cardStyles.tag} style={{ color: 'var(--warning)' }}>缺依据</span>
            </Show>
            <span
              class={`${cardStyles.priority} ${props.item.priority === 1 ? cardStyles.priorityMed : ''} ${props.item.priority === 2 ? cardStyles.priorityHigh : ''}`}
            >
              {props.item.priority === 1 ? '●' : props.item.priority === 2 ? '●●' : ''}
            </span>
          </div>
          <Show when={copy().subtitle || props.item.due_date}>
            <div class={cardStyles.metaRow}>
              <Show when={copy().subtitle}>
                <span class={cardStyles.dueDate}>{copy().subtitle}</span>
              </Show>
              <Show when={props.item.due_date}>
                <span class={`${cardStyles.dueDate} ${overdueRow() ? cardStyles.dueDateOverdue : ''}`}>
                  {formatDue(props.item.due_date!)}
                </span>
              </Show>
            </div>
          </Show>
        </div>
      </div>
    </div>
  )
}

const AgendaList: Component<Props> = (props) => {
  const overdue = () => props.overdueItems ?? []
  const today = () => props.items
  const hasSections = () => props.overdueItems != null
  const isEmpty = () => overdue().length === 0 && today().length === 0

  return (
    <div class={listStyles.container}>
      <div class={listStyles.header}>
        <h2 class={listStyles.title}>{props.title}</h2>
      </div>
      <Show when={props.error}>
        <div class={listStyles.error}>
          <p class={listStyles.errorText}>加载失败</p>
          <button class={listStyles.retryBtn} onClick={props.onRetry}>重试</button>
        </div>
      </Show>
      <Show when={props.loading && !props.error}>
        <p class={listStyles.emptyHint}>加载中…</p>
      </Show>
      <Show when={!props.loading && !props.error && isEmpty()}>
        <div class={listStyles.empty}>
          <p class={listStyles.emptyTitle}>暂无安排</p>
          <p class={listStyles.emptyHint}>任务与事项的当前步会出现在这里</p>
        </div>
      </Show>
      <Show when={!props.loading && !props.error && !isEmpty()}>
        <div class={listStyles.list}>
          <Show when={hasSections() && overdue().length > 0}>
            <p class={listStyles.sectionLabel}>逾期</p>
            <For each={overdue()}>
              {(item) => <AgendaRow item={item} onToggle={props.onToggle} onClick={props.onClick} />}
            </For>
          </Show>
          <Show when={hasSections() && today().length > 0}>
            <p class={listStyles.sectionLabel}>今日</p>
            <For each={today()}>
              {(item) => <AgendaRow item={item} onToggle={props.onToggle} onClick={props.onClick} />}
            </For>
          </Show>
          <Show when={!hasSections()}>
            <For each={today()}>
              {(item) => <AgendaRow item={item} onToggle={props.onToggle} onClick={props.onClick} />}
            </For>
          </Show>
        </div>
      </Show>
    </div>
  )
}

export default AgendaList
