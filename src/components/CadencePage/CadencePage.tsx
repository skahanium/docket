import { type Component, For, Show, createResource, createSignal } from 'solid-js'
import styles from '../DomainPage/DomainPage.module.css'
import {
  cadences,
  playbooks,
  tags,
  createCadence,
  updateCadence,
  getCadenceProgress,
  invalidateAfterMutation,
  taskMutationEpoch,
  pushToast,
  selectMatter,
} from '../../stores'
import type { Cadence, CadenceProgress } from '../../bindings/types'
import { inclusiveEndDate } from '../../utils/cadencePeriod'

const PERIOD_LABEL: Record<string, string> = {
  month: '每月',
  quarter: '每季',
  year: '每年',
}

const idsOf = (ids: (number | null)[]) => ids.filter((id): id is number => id != null)

interface Props {
  stacked?: boolean
}

const CadencePage: Component<Props> = (props) => {
  const [title, setTitle] = createSignal('')
  const [period, setPeriod] = createSignal('month')
  const [target, setTarget] = createSignal('')
  const [pbIds, setPbIds] = createSignal<number[]>([])
  const [tagIds, setTagIds] = createSignal<number[]>([])
  const [openId, setOpenId] = createSignal<number | null>(null)
  const [editId, setEditId] = createSignal<number | null>(null)

  const [progress] = createResource(
    () => {
      const id = openId()
      return id != null ? ([id, taskMutationEpoch()] as const) : null
    },
    ([id]) => getCadenceProgress(id),
  )

  const toggle = (list: number[], id: number) =>
    list.includes(id) ? list.filter((x) => x !== id) : [...list, id]

  const resetForm = () => {
    setEditId(null)
    setTitle('')
    setPeriod('month')
    setTarget('')
    setPbIds([])
    setTagIds([])
  }

  const startEdit = (c: Cadence) => {
    setEditId(c.id)
    setTitle(c.title)
    setPeriod(c.period)
    setTarget(c.target_count != null ? String(c.target_count) : '')
    setPbIds(idsOf(c.playbook_ids))
    setTagIds(idsOf(c.tag_ids))
  }

  const submit = async () => {
    const t = title().trim()
    if (!t) return
    const emptyTarget = !target().trim()
    try {
      const id = editId()
      if (id != null) {
        await updateCadence(id, {
          title: t,
          period: period(),
          target_count: emptyTarget ? null : Number(target()),
          clear_target_count: emptyTarget,
          playbook_ids: pbIds(),
          tag_ids: tagIds(),
        })
        pushToast('success', '指标已保存')
      } else {
        await createCadence({
          title: t,
          period: period(),
          target_count: emptyTarget ? null : Number(target()),
          playbook_ids: pbIds(),
          tag_ids: tagIds(),
        })
        pushToast('success', '指标已创建')
      }
      resetForm()
      invalidateAfterMutation()
    } catch (e) {
      pushToast('error', String(e))
    }
  }

  return (
    <div class={`${styles.container} ${props.stacked ? styles.stacked : ''}`}>
      <h2 class={styles.title}>周期指标</h2>
      <p class={styles.lead}>按办结事项自动计数，不出现在今日。不限模板时空白事项也计入。</p>

      <div class={styles.form}>
        <input class={styles.input} placeholder="指标名称，如本月办结" value={title()} onInput={(e) => setTitle(e.currentTarget.value)} />
        <div class={styles.row}>
          <select class={styles.select} value={period()} onChange={(e) => setPeriod(e.currentTarget.value)}>
            <option value="month">每月</option>
            <option value="quarter">每季</option>
            <option value="year">每年</option>
          </select>
          <input class={styles.input} type="number" min={1} placeholder="目标（可选）" value={target()} onInput={(e) => setTarget(e.currentTarget.value)} />
          <button class={`${styles.btn} ${styles.btnPrimary}`} disabled={!title().trim()} onClick={() => void submit()}>
            {editId() != null ? '保存' : '新建'}
          </button>
          <Show when={editId() != null}>
            <button class={styles.btn} onClick={resetForm}>取消</button>
          </Show>
        </div>
        <p class={styles.cardMeta}>限定模板（空=不限，含空白事项）</p>
        <div class={styles.chips}>
          <For each={(playbooks() ?? []).filter((p) => !p.archived_at)}>
            {(p) => (
              <button class={`${styles.chip} ${pbIds().includes(p.id) ? styles.chipOn : ''}`} onClick={() => setPbIds(toggle(pbIds(), p.id))}>
                {p.title}
              </button>
            )}
          </For>
        </div>
        <p class={styles.cardMeta}>须同时具备的标签（空=不限）</p>
        <div class={styles.chips}>
          <For each={tags() ?? []}>
            {(t) => (
              <button class={`${styles.chip} ${tagIds().includes(t.id) ? styles.chipOn : ''}`} onClick={() => setTagIds(toggle(tagIds(), t.id))}>
                {t.name}
              </button>
            )}
          </For>
        </div>
      </div>

      <For each={cadences() ?? []}>
        {(c: Cadence) => (
          <CadenceCard
            cadence={c}
            open={openId() === c.id}
            onOpen={() => setOpenId(openId() === c.id ? null : c.id)}
            onEdit={() => startEdit(c)}
            progress={openId() === c.id ? (progress() ?? null) : null}
          />
        )}
      </For>
    </div>
  )
}

const CadenceCard: Component<{
  cadence: Cadence
  open: boolean
  onOpen: () => void
  onEdit: () => void
  progress: CadenceProgress | null | undefined
}> = (props) => {
  const [live] = createResource(
    () => [props.cadence.id, taskMutationEpoch()] as const,
    ([id]) => getCadenceProgress(id),
  )
  const data = () => props.progress ?? live()
  const pct = () => {
    const p = data()
    if (!p || !p.cadence.target_count) return 0
    return Math.min(100, Math.round((p.completed_count / p.cadence.target_count) * 100))
  }

  return (
    <div class={styles.card} onClick={props.onOpen}>
      <div class={styles.cardTitle}>{props.cadence.title}</div>
      <div class={styles.cardMeta}>
        {PERIOD_LABEL[props.cadence.period] ?? props.cadence.period}
        {data()
          ? ` · ${data()!.completed_count}${props.cadence.target_count ? ` / ${props.cadence.target_count}` : ''}`
          : ''}
        {data() ? ` · ${data()!.period_start} 至 ${inclusiveEndDate(data()!.period_end)}` : ''}
      </div>
      <Show when={props.cadence.target_count}>
        <div class={styles.progress}><div class={styles.progressFill} style={{ width: `${pct()}%` }} /></div>
      </Show>
      <button
        class={styles.btn}
        onClick={(e) => {
          e.stopPropagation()
          props.onEdit()
        }}
      >
        编辑
      </button>
      <Show when={props.open && data()}>
        <div class={styles.stepList} onClick={(e) => e.stopPropagation()}>
          <Show when={data()!.matching_matters.length === 0}>
            <p class={styles.empty}>本期间还没有命中的办结事项</p>
          </Show>
          <For each={data()!.matching_matters}>
            {(m) => (
              <button class={styles.btn} onClick={() => selectMatter(m.id)}>
                {m.title}
                <Show when={m.status === 'archived'}>
                  <span style={{ color: 'var(--text-label)', 'font-size': '12px' }}>已归档</span>
                </Show>
              </button>
            )}
          </For>
        </div>
      </Show>
    </div>
  )
}

export default CadencePage
