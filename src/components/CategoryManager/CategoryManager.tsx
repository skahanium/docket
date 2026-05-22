import { type Component, createSignal, For, Show } from 'solid-js'
import styles from './CategoryManager.module.css'
import { createCategory, updateCategory, deleteCategory, categories, refetchCategories, pushToast } from '../../stores'
import type { Category } from '../../bindings/types'

const CategoryManager: Component = () => {
  const [adding, setAdding] = createSignal(false)
  const [newName, setNewName] = createSignal('')
  const [newColor, setNewColor] = createSignal('#3B82F6')
  const [editingId, setEditingId] = createSignal<number | null>(null)
  const [editName, setEditName] = createSignal('')
  const [editColor, setEditColor] = createSignal('')

  const handleAdd = async () => {
    const n = newName().trim(); if (!n) return
    try { await createCategory(n, newColor()); pushToast('success', '分类已创建'); refetchCategories(); setNewName(''); setAdding(false) }
    catch (e) { pushToast('error', `创建失败: ${e}`) }
  }

  const startEdit = (c: Category) => {
    setEditingId(c.id); setEditName(c.name); setEditColor(c.color ?? '#3B82F6')
  }

  const handleUpdate = async (id: number) => {
    const n = editName().trim(); if (!n) return
    try { await updateCategory(id, n, editColor()); pushToast('success', '已更新'); refetchCategories(); setEditingId(null) }
    catch (e) { pushToast('error', `更新失败: ${e}`) }
  }

  const handleDelete = async (id: number) => {
    try { await deleteCategory(id); pushToast('success', '已删除'); refetchCategories() }
    catch (e) { pushToast('error', `删除失败: ${e}`) }
  }

  return (
    <div class={styles.manager}>
      <div class={styles.header}>
        <span class={styles.title}>管理分类</span>
        <Show when={!adding()} fallback={
          <div class={styles.addRow}>
            <input class={styles.nameInput} value={newName()} onInput={(e) => setNewName(e.currentTarget.value)} placeholder="分类名称" />
            <input type="color" class={styles.colorInput} value={newColor()} onInput={(e) => setNewColor(e.currentTarget.value)} />
            <button class={styles.saveBtn} onClick={handleAdd} disabled={!newName().trim()}>保存</button>
            <button class={styles.cancelBtn} onClick={() => setAdding(false)}>取消</button>
          </div>
        }>
          <button class={styles.addBtn} onClick={() => setAdding(true)}>+ 新建</button>
        </Show>
      </div>
      <For each={categories() ?? []}>{(c) => (
        <Show when={editingId() === c.id} fallback={
          <div class={styles.item}>
            <span class={styles.dot} style={{ background: c.color ?? 'var(--accent)' }} />
            <span class={styles.itemName}>{c.name}</span>
            <button class={styles.itemBtn} onClick={() => startEdit(c)}>编辑</button>
            <button class={`${styles.itemBtn} ${styles.itemBtnDanger}`} onClick={() => handleDelete(c.id)}>删除</button>
          </div>
        }>
          <div class={styles.addRow}>
            <input class={styles.nameInput} value={editName()} onInput={(e) => setEditName(e.currentTarget.value)} />
            <input type="color" class={styles.colorInput} value={editColor()} onInput={(e) => setEditColor(e.currentTarget.value)} />
            <button class={styles.saveBtn} onClick={() => handleUpdate(c.id)} disabled={!editName().trim()}>保存</button>
            <button class={styles.cancelBtn} onClick={() => setEditingId(null)}>取消</button>
          </div>
        </Show>
      )}</For>
    </div>
  )
}

export default CategoryManager
