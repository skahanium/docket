import { type Component, For, Show } from 'solid-js'
import listStyles from '../TaskList/TaskList.module.css'
import cardStyles from '../TaskCard/TaskCard.module.css'
import Checkbox from '../shared/Checkbox'
import type { AgendaItem } from '../../bindings/types'
import { agendaRowCopy } from '../../utils/agendaMap'
import { localDateString } from '../../utils/date'

interface Props {
  title: string
  items: AgendaItem[]
  loading: boolean
  error: string | null
  onToggle: (item: AgendaItem) => void
  onClick: (item: AgendaItem) => void
  onRetry: () => void
}

const AgendaList: Component<Props> = (props) => {
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
      <Show when={!props.loading && !props.error && props.items.length === 0}>
        <div class={listStyles.empty}>
          <p class={listStyles.emptyTitle}>暂无安排</p>
          <p class={listStyles.emptyHint}>任务与事项的当前步会出现在这里</p>
        </div>
      </Show>
      <Show when={!props.loading && !props.error && props.items.length > 0}>
        <div class={listStyles.list}>
          <For each={props.items}>
            {(item) => {
              const copy = agendaRowCopy(item)
              const overdue = !!item.due_date && item.due_date < localDateString()
              return (
                <div class={listStyles.taskRow}>
                  <div
                    class={`${cardStyles.card} ${overdue ? cardStyles.cardOverdue : ''}`}
                    role="button"
                    tabindex={0}
                    onClick={() => props.onClick(item)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        props.onClick(item)
                      }
                    }}
                  >
                    <Checkbox
                      checked={false}
                      onClick={(e) => {
                        e.stopPropagation()
                        props.onToggle(item)
                      }}
                    />
                    <div class={cardStyles.body}>
                      <div class={cardStyles.titleRow}>
                        <span class={cardStyles.title}>{copy.title}</span>
                        <Show when={item.missing_evidence}>
                          <span class={cardStyles.tag} style={{ color: 'var(--warning)' }}>缺依据</span>
                        </Show>
                        <span
                          class={`${cardStyles.priority} ${item.priority === 1 ? cardStyles.priorityMed : ''} ${item.priority === 2 ? cardStyles.priorityHigh : ''}`}
                        >
                          {item.priority === 1 ? '●' : item.priority === 2 ? '●●' : ''}
                        </span>
                      </div>
                      <Show when={copy.subtitle || item.due_date}>
                        <div class={cardStyles.metaRow}>
                          <Show when={copy.subtitle}>
                            <span class={cardStyles.dueDate}>{copy.subtitle}</span>
                          </Show>
                          <Show when={item.due_date}>
                            <span class={`${cardStyles.dueDate} ${overdue ? cardStyles.dueDateOverdue : ''}`}>
                              {item.due_date}
                            </span>
                          </Show>
                        </div>
                      </Show>
                    </div>
                  </div>
                </div>
              )
            }}
          </For>
        </div>
      </Show>
    </div>
  )
}

export default AgendaList
