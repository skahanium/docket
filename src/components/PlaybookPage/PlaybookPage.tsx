import { type Component, For, Show, createSignal } from 'solid-js'
import styles from '../DomainPage/DomainPage.module.css'
import {
  playbooks,
  createPlaybook,
  updatePlaybook,
  setPlaybookSteps,
  invalidateAfterMutation,
  pushToast,
} from '../../stores'
import type { Playbook, PlaybookStepInput } from '../../bindings/types'

const PlaybookPage: Component = () => {
  const [title, setTitle] = createSignal('')
  const [editing, setEditing] = createSignal<Playbook | null>(null)
  const [steps, setSteps] = createSignal<PlaybookStepInput[]>([])

  const startEdit = (pb: Playbook) => {
    setEditing(pb)
    setSteps(
      pb.steps.map((s) => ({
        title: s.title,
        optional: s.optional,
        evidence_required: s.evidence_required,
        estimated_minutes: s.estimated_minutes,
      })),
    )
  }

  const create = async () => {
    const t = title().trim()
    if (!t) return
    try {
      const id = await createPlaybook({ title: t })
      setTitle('')
      invalidateAfterMutation()
      const created = (playbooks() ?? []).find((p) => p.id === id)
      if (created) startEdit(created)
      else setEditing({ id, title: t, archived_at: null, steps: [] })
    } catch (e) {
      pushToast('error', String(e))
    }
  }

  const saveSteps = async () => {
    const pb = editing()
    if (!pb) return
    const cleaned = steps().filter((s) => s.title.trim())
    try {
      await setPlaybookSteps(pb.id, cleaned)
      pushToast('success', '模板步骤已保存')
      invalidateAfterMutation()
    } catch (e) {
      pushToast('error', String(e))
    }
  }

  const archive = async (pb: Playbook) => {
    try {
      await updatePlaybook(pb.id, { archived: !pb.archived_at })
      invalidateAfterMutation()
    } catch (e) {
      pushToast('error', String(e))
    }
  }

  return (
    <div class={styles.container}>
      <div class={styles.header}>
        <h2 class={styles.title}>流程模板</h2>
      </div>
      <p class={styles.lead}>模板决定事项的步骤拷贝。已创建的事项不会随模板改动。</p>
      <div class={styles.row}>
        <input class={styles.input} placeholder="新模板名称" value={title()} onInput={(e) => setTitle(e.currentTarget.value)} />
        <button class={`${styles.btn} ${styles.btnPrimary}`} disabled={!title().trim()} onClick={() => void create()}>新建模板</button>
      </div>

      <Show when={editing()}>
        <div class={styles.form}>
          <p class={styles.cardTitle}>编辑：{editing()!.title}</p>
          <For each={steps()}>
            {(step, i) => (
              <div class={styles.step}>
                <span>{i() + 1}</span>
                <input
                  class={styles.input}
                  value={step.title}
                  onInput={(e) => {
                    const next = [...steps()]
                    next[i()] = { ...next[i()], title: e.currentTarget.value }
                    setSteps(next)
                  }}
                />
                <label class={styles.cardMeta}>
                  <input
                    type="checkbox"
                    checked={step.evidence_required}
                    onChange={(e) => {
                      const next = [...steps()]
                      next[i()] = { ...next[i()], evidence_required: e.currentTarget.checked }
                      setSteps(next)
                    }}
                  />
                  {' '}需要依据
                </label>
              </div>
            )}
          </For>
          <div class={styles.row}>
            <button class={styles.btn} onClick={() => setSteps([...steps(), { title: '', optional: false, evidence_required: false, estimated_minutes: null }])}>加一步</button>
            <button class={`${styles.btn} ${styles.btnPrimary}`} onClick={() => void saveSteps()}>保存步骤</button>
            <button class={styles.btn} onClick={() => setEditing(null)}>完成</button>
          </div>
        </div>
      </Show>

      <For each={playbooks() ?? []}>
        {(pb) => (
          <div class={styles.card} onClick={() => startEdit(pb)}>
            <div class={styles.cardTitle}>
              {pb.title}
              <Show when={pb.archived_at}><span class={styles.badge}>已归档</span></Show>
            </div>
            <div class={styles.cardMeta}>{pb.steps.length} 步</div>
            <button
              class={styles.btn}
              onClick={(e) => { e.stopPropagation(); void archive(pb) }}
            >
              {pb.archived_at ? '取消归档' : '归档'}
            </button>
          </div>
        )}
      </For>
    </div>
  )
}

export default PlaybookPage
