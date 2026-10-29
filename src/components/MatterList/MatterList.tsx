import { type Component, For, Show } from 'solid-js'
import styles from '../DomainPage/DomainPage.module.css'
import { matters, playbooks, selectMatter } from '../../stores'

const STATUS: Record<string, string> = {
  active: '进行中',
  completed: '已办结',
  archived: '已归档',
}

const MatterList: Component = () => {
  const playbookTitle = (id: number | null) => {
    if (id == null) return '空白事项'
    return playbooks()?.find((p) => p.id === id)?.title ?? '模板'
  }

  return (
    <div class={styles.container}>
      <h2 class={styles.title}>事项库</h2>
      <p class={styles.lead}>有程序的工作在这里。今日只露出每个事项的当前步。</p>
      <Show
        when={(matters() ?? []).length > 0}
        fallback={<p class={styles.empty}>还没有事项。用顶部「新建」从模板创建，或建空白事项后加步。</p>}
      >
        <For each={matters() ?? []}>
          {(m) => (
            <button type="button" class={styles.card} onClick={() => selectMatter(m.id)}>
              <div class={styles.cardTitle}>
                {m.title}
                <Show when={m.missing_evidence}>
                  <span class={styles.badge}>缺依据</span>
                </Show>
              </div>
              <div class={styles.cardMeta}>
                {STATUS[m.status] ?? m.status} · {playbookTitle(m.playbook_id)}
                {m.current_step ? ` · 当前：${m.current_step.title}` : ''}
                {m.due_date ? ` · ${m.due_date}` : ''}
              </div>
            </button>
          )}
        </For>
      </Show>
    </div>
  )
}

export default MatterList
