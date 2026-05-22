import { createSignal } from 'solid-js'

export type ViewKind = 'all' | 'today' | 'schedule' | 'calendar' | 'stats' | 'archive' | 'settings'

export let activeView: ReturnType<typeof createSignal<ViewKind>>[0]
export let setActiveView: ReturnType<typeof createSignal<ViewKind>>[1]

export let selectedTaskId: ReturnType<typeof createSignal<number | null>>[0]
export let setSelectedTaskId: ReturnType<typeof createSignal<number | null>>[1]

export let selectTask: (id: number) => void
export let deselectTask: () => void

export function installNavigation(): void {
  ;[activeView, setActiveView] = createSignal<ViewKind>('all')
  ;[selectedTaskId, setSelectedTaskId] = createSignal<number | null>(null)
  selectTask = (id: number) => setSelectedTaskId(id)
  deselectTask = () => setSelectedTaskId(null)
}
