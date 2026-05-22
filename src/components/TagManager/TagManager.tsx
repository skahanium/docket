import { type Component, createSignal, For, Show } from 'solid-js'
import styles from './TagManager.module.css'
import { createTag, updateTag, deleteTag, tags, refetchTags, pushToast } from '../../stores'
import type { Tag } from '../../bindings/types'

const TagManager: Component = () => {
  const [adding, setAdding] = createSignal(false)
  const [newName, setNewName] = createSignal('')
  const [newColor, setNewColor] = createSignal('#8B5CF6')
  const [editingId, setEditingId] = createSignal<number | null>(null)
  const [editName, setEditName] = createSignal('')
  const [editColor, setEditColor] = createSignal('')

  const handleAdd = async () => {
    const n = newName().trim(); if (!n) return
    try { await createTag(n, newColor()); pushToast('success', '标签已创建'); refetchTags(); setNewName(''); setAdding(false) }
    catch (e) { pushToast('error', `创建失败: ${e}`) }
  }

  const startEdit = (t: Tag) => {
    setEditingId(t.id); setEditName(t.name); setEditColor(t.color ?? '#8B5CF6')
  }

  const handleUpdate = async (id: number) => {
    const n = editName().trim(); if (!n) return
    try { await updateTag(id, n, editColor()); pushToast('success', '已更新'); refetchTags(); setEditingId(null) }
    catch (e) { pushToast('error', `更新失败: ${e}`) }
  }

  const handleDelete = async (id: number) => {
    try { await deleteTag(id); pushToast('success', '已删除'); refetchTags() }
    catch (e) { pushToast('error', `删除失败: ${e}`) }
  }

  return (
    <div class={styles.manager}>
      <div class={styles.header}>
        <span class={styles.title}>管理标签</span>
        <Show when={!adding()} fallback={
          <div class={styles.addRow}>
            <input class={styles.nameInput} value={newName()} onInput={(e) => setNewName(e.currentTarget.value)} placeholder="标签名称" />
            <input type="color" class={styles.colorInput} value={newColor()} onInput={(e) => setNewColor(e.currentTarget.value)} />
            <button class={styles.saveBtn} onClick={handleAdd} disabled={!newName().trim()}>保存</button>
            <button class={styles.cancelBtn} onClick={() => setAdding(false)}>取消</button>
          </div>
        }>
          <button class={styles.addBtn} onClick={() => setAdding(true)}>+ 新建</button>
        </Show>
      </div>
      <For each={tags() ?? []}>{(t) => (
        <Show when={editingId() === t.id} fallback={
          <div class={styles.item}>
            <span class={styles.dot} style={{ background: t.color ?? 'var(--text-label)' }} />
            <span class={styles.itemName}>{t.name}</span>
            <button class={styles.itemBtn} onClick={() => startEdit(t)}>编辑</button>
            <button class={`${styles.itemBtn} ${styles.itemBtnDanger}`} onClick={() => handleDelete(t.id)}>删除</button>
          </div>
        }>
          <div class={styles.addRow}>
            <input class={styles.nameInput} value={editName()} onInput={(e) => setEditName(e.currentTarget.value)} />
            <input type="color" class={styles.colorInput} value={editColor()} onInput={(e) => setEditColor(e.currentTarget.value)} />
            <button class={styles.saveBtn} onClick={() => handleUpdate(t.id)} disabled={!editName().trim()}>保存</button>
            <button class={styles.cancelBtn} onClick={() => setEditingId(null)}>取消</button>
          </div>
        </Show>
      )}</For>
    </div>
  )
}

export default TagManager
