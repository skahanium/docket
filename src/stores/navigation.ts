import { createSignal } from 'solid-js'

export type ViewKind =
  | 'today'
  | 'tasks'
  | 'matters'
  | 'calendar'
  | 'progress'

export type Facet = { type: 'category'; id: number } | { type: 'tag'; id: number }

export let activeView: ReturnType<typeof createSignal<ViewKind>>[0]
export let setActiveView: ReturnType<typeof createSignal<ViewKind>>[1]

export let openFacet: ReturnType<typeof createSignal<Facet | null>>[0]
export let setOpenFacet: ReturnType<typeof createSignal<Facet | null>>[1]

export let selectedTaskId: ReturnType<typeof createSignal<number | null>>[0]
export let setSelectedTaskId: ReturnType<typeof createSignal<number | null>>[1]

export let selectedMatterId: ReturnType<typeof createSignal<number | null>>[0]
export let setSelectedMatterId: ReturnType<typeof createSignal<number | null>>[1]

export let selectTask: (id: number) => void
export let deselectTask: () => void
export let selectMatter: (id: number) => void
export let deselectMatter: () => void
export let goToView: (view: ViewKind) => void
export let goToFacet: (facet: Facet) => void

export function isTrackActive(facet: Facet | null, view: ViewKind, track: ViewKind): boolean {
  return facet == null && view === track
}

export function isFacetActive(facet: Facet | null, type: Facet['type'], id: number): boolean {
  return facet != null && facet.type === type && facet.id === id
}

export function facetMissing(
  facet: Facet,
  categories: { id: number }[],
  tags: { id: number }[],
): boolean {
  if (facet.type === 'category') return !categories.some((c) => c.id === facet.id)
  return !tags.some((t) => t.id === facet.id)
}

export function sameFacet(a: Facet | null, b: Facet | null): boolean {
  if (a === b) return true
  if (a == null || b == null) return false
  return a.type === b.type && a.id === b.id
}

export function installNavigation(): void {
  ;[activeView, setActiveView] = createSignal<ViewKind>('today')
  ;[openFacet, setOpenFacet] = createSignal<Facet | null>(null, { equals: sameFacet })
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
  goToView = (view: ViewKind) => {
    setOpenFacet(null)
    setActiveView(view)
  }
  goToFacet = (facet: Facet) => {
    setOpenFacet(facet)
  }
}
