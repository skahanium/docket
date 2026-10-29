import { createSignal } from 'solid-js'

export type ViewKind =
  | 'all'
  | 'today'
  | 'overdue'
  | 'schedule'
  | 'calendar'
  | 'stats'
  | 'archive'
  | 'settings'
  | 'matters'
  | 'playbooks'
  | 'cadences'

export let activeView: ReturnType<typeof createSignal<ViewKind>>[0]
export let setActiveView: ReturnType<typeof createSignal<ViewKind>>[1]

export let selectedTaskId: ReturnType<typeof createSignal<number | null>>[0]
export let setSelectedTaskId: ReturnType<typeof createSignal<number | null>>[1]

export let selectedMatterId: ReturnType<typeof createSignal<number | null>>[0]
export let setSelectedMatterId: ReturnType<typeof createSignal<number | null>>[1]

export let selectTask: (id: number) => void
export let deselectTask: () => void
export let selectMatter: (id: number) => void
export let deselectMatter: () => void

export function installNavigation(): void {
  ;[activeView, setActiveView] = createSignal<ViewKind>('all')
  ;[selectedTaskId, setSelectedTaskId] = createSignal<number | null>(null)
  ;[selectedMatterId, setSelectedMatterId] = createSignal<number | null>(null)
  selectTask = (id: number) => {
    setSelectedMatterId(null)
    setSelectedTaskId(id)
  }
  deselectTask = () => setSelectedTaskId(null)
  selectMatter = (id: number) => {
    setSelectedTaskId(null)
    setSelectedMatterId(id)
  }
  deselectMatter = () => setSelectedMatterId(null)
}
