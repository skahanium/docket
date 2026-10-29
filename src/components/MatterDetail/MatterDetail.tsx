import { type Component, For, Show, createSignal } from 'solid-js'
import styles from '../TaskDetail/TaskDetail.module.css'
import page from '../DomainPage/DomainPage.module.css'
import {
  matterDetail,
  selectedMatterId,
  deselectMatter,
  playbooks,
  tags,
  pushToast,
  invalidateAfterMutation,
  updateMatter,
  completeMatterStep,
  skipMatterStep,
  reopenMatterStep,
  addMatterStep,
  addTagToMatter,
  removeTagFromMatter,
  addStepLink,
  removeStepLink,
  openStepLink,
  revealStepLink,
  pickEvidencePath,
} from '../../stores'
import { evidenceLinkInput } from '../../utils/evidencePatch'

const STEP_LABEL: Record<string, string> = {
  pending: '未开始',
  completed: '已完成',
  skipped: '已跳过',
}

const MatterDetail: Component = () => {
  const detail = () => matterDetail()
  const open = () => selectedMatterId() != null && matterDetail.state === 'ready' && detail() != null
  const [stepTitle, setStepTitle] = createSignal('')
  const [requireEvidence, setRequireEvidence] = createSignal(false)
  const [addingTag, setAddingTag] = createSignal(false)

  const playbookName = () => {
    const d = detail()
    if (!d) return ''
    if (d.playbook_id == null) return '空白事项'
    return playbooks()?.find((p) => p.id === d.playbook_id)?.title ?? '模板'
  }

  const saveTitle = async (title: string) => {
    const d = detail()
    if (!d) return
    const t = title.trim()
    if (!t || t === d.title) return
    try {
      await updateMatter(d.id, { title: t })
      invalidateAfterMutation()
    } catch (e) {
      pushToast('error', `保存失败: ${e}`)
    }
  }

  const act = async (fn: () => Promise<void>, ok: string) => {
    try {
      await fn()
      pushToast('success', ok)
      invalidateAfterMutation()
    } catch (e) {
      pushToast('error', String(e))
    }
  }

  const addStep = async () => {
    const d = detail()
    const t = stepTitle().trim()
    if (!d || !t) return
    await act(async () => {
      await addMatterStep(d.id, { title: t, evidence_required: requireEvidence() })
      setStepTitle('')
      setRequireEvidence(false)
    }, '已加一步')
  }

  const bindPath = async (stepId: number, directory: boolean) => {
    try {
      const picked = await pickEvidencePath(directory)
      const input = evidenceLinkInput(picked ?? '', directory ? 'folder' : 'file')
      if (!input) return
      await addStepLink(stepId, input)
      invalidateAfterMutation()
    } catch (e) {
      pushToast('error', String(e))
    }
  }

  return (
    <Show when={open()}>
      <div class={styles.overlay} onClick={deselectMatter} />
      <aside class={styles.panel}>
        <div class={styles.header}>
          <h3 class={styles.title}>事项</h3>
          <button class={styles.closeBtn} onClick={deselectMatter} aria-label="关闭">×</button>
        </div>
        <Show when={detail()} keyed fallback={<div class={styles.body}><p style="font-size:14px;color:var(--text-sub)">加载中…</p></div>}>
          {(d) => (
          <div class={styles.body}>
            <input
              class={styles.taskTitle}
              value={d.title}
              onChange={(e) => void saveTitle(e.currentTarget.value)}
            />
            <div class={styles.propGroup}>
              <div class={styles.propRow}>
                <span class={styles.propLabel}>模板</span>
                <span class={styles.propValue}>{playbookName()}</span>
              </div>
              <div class={styles.propRow}>
                <span class={styles.propLabel}>状态</span>
                <span class={styles.propValue}>{d.status === 'completed' ? '已办结' : '进行中'}</span>
              </div>
              <div class={styles.propRow}>
                <span class={styles.propLabel}>优先级</span>
                <select
                  class={styles.propSelect}
                  value={d.priority}
                  onChange={(e) => {
                    void updateMatter(d.id, { priority: Number(e.currentTarget.value) }).then(() =>
                      invalidateAfterMutation(),
                    )
                  }}
                >
                  <option value={0}>低</option>
                  <option value={1}>中</option>
                  <option value={2}>高</option>
                </select>
              </div>
            </div>

            <p class={styles.propLabel}>标签</p>
            <div class={page.chips}>
              <For each={d.tags}>
                {(t) => (
                  <button class={`${page.chip} ${page.chipOn}`} onClick={() => void act(() => removeTagFromMatter(d.id, t.id), '已移除标签')}>
                    {t.name} ×
                  </button>
                )}
              </For>
              <button class={page.chip} onClick={() => setAddingTag((v) => !v)}>+ 标签</button>
            </div>
            <Show when={addingTag()}>
              <div class={page.chips}>
                <For each={(tags() ?? []).filter((t) => !d.tags.some((x) => x.id === t.id))}>
                  {(t) => (
                    <button class={page.chip} onClick={() => void act(() => addTagToMatter(d.id, t.id), '已加标签')}>
                      {t.name}
                    </button>
                  )}
                </For>
              </div>
            </Show>

            <p class={styles.propLabel}>步骤</p>
            <div class={page.stepList}>
              <For each={d.steps}>
                {(step) => {
                  const current = d.current_step?.id === step.id
                  return (
                    <div class={`${page.step} ${current ? page.stepCurrent : ''} ${step.status !== 'pending' ? page.stepDone : ''}`}>
                      <span>{step.status === 'completed' ? '✓' : step.status === 'skipped' ? '–' : current ? '→' : '·'}</span>
                      <div>
                        <div>{step.title}</div>
                        <div class={page.cardMeta}>
                          {STEP_LABEL[step.status]}
                          {step.evidence_required ? ' · 建议有依据' : ''}
                          {step.missing_evidence ? ' · 缺依据' : ''}
                        </div>
                        <For each={step.links}>
                          {(link) => (
                            <div class={page.linkRow}>
                              <span class={link.exists ? undefined : page.pathBroken}>{link.path}</span>
                              <button class={page.btnGhost} onClick={() => void openStepLink(link.id).catch((e) => pushToast('error', String(e)))}>打开</button>
                              <button class={page.btnGhost} onClick={() => void revealStepLink(link.id).catch((e) => pushToast('error', String(e)))}>显示</button>
                              <button class={page.btnGhost} onClick={() => void act(() => removeStepLink(link.id), '已解绑')}>解绑</button>
                              <Show when={!link.exists}>
                                <button class={page.btnGhost} onClick={() => void bindPath(step.id, link.kind === 'folder')}>改绑</button>
                              </Show>
                            </div>
                          )}
                        </For>
                      </div>
                      <div class={page.row}>
                        <Show when={step.status === 'pending'}>
                          <button class={page.btn} onClick={() => void act(() => completeMatterStep(step.id), '已完成此步')}>完成</button>
                          <button class={page.btn} onClick={() => void act(() => skipMatterStep(step.id), '已跳过')}>跳过</button>
                        </Show>
                        <Show when={step.status !== 'pending'}>
                          <button class={page.btn} onClick={() => void act(() => reopenMatterStep(step.id), '已重开')}>回头</button>
                        </Show>
                        <button class={page.btn} onClick={() => void bindPath(step.id, false)}>文件</button>
                        <button class={page.btn} onClick={() => void bindPath(step.id, true)}>文件夹</button>
                      </div>
                    </div>
                  )
                }}
              </For>
            </div>

            <div class={page.form}>
              <input
                class={page.input}
                placeholder="加一步（空白事项或补充步骤）"
                value={stepTitle()}
                onInput={(e) => setStepTitle(e.currentTarget.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') void addStep() }}
              />
              <label class={page.cardMeta}>
                <input type="checkbox" checked={requireEvidence()} onChange={(e) => setRequireEvidence(e.currentTarget.checked)} />
                {' '}此步建议有依据
              </label>
              <button class={page.btn} disabled={!stepTitle().trim()} onClick={() => void addStep()}>添加步骤</button>
            </div>
          </div>
          )}
        </Show>
      </aside>
    </Show>
  )
}

export default MatterDetail
