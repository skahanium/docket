import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createRoot } from 'solid-js'
import { installCalendarUi } from './calendarUi'
import { installFiltersSort, clearFilters } from './filtersSort'
import {
  activeView,
  facetMissing,
  goToFacet,
  goToView,
  installNavigation,
  isFacetActive,
  isTrackActive,
  openFacet,
  sameFacet,
  type Facet,
} from './navigation'

describe('facet navigation', () => {
  const cat: Facet = { type: 'category', id: 1 }

  it('highlights a track only when no facet is open', () => {
    expect(isTrackActive(null, 'today', 'today')).toBe(true)
    expect(isTrackActive(cat, 'today', 'today')).toBe(false)
    expect(isTrackActive(null, 'tasks', 'today')).toBe(false)
  })

  it('highlights the open facet and not the other kind', () => {
    expect(isFacetActive(cat, 'category', 1)).toBe(true)
    expect(isFacetActive(cat, 'category', 2)).toBe(false)
    expect(isFacetActive(cat, 'tag', 1)).toBe(false)
    expect(isFacetActive(null, 'category', 1)).toBe(false)
  })

  it('treats a deleted category or tag as missing', () => {
    expect(facetMissing(cat, [{ id: 2 }], [])).toBe(true)
    expect(facetMissing(cat, [{ id: 1 }], [])).toBe(false)
    expect(facetMissing({ type: 'tag', id: 9 }, [], [{ id: 9 }])).toBe(false)
    expect(facetMissing({ type: 'tag', id: 9 }, [], [])).toBe(true)
  })

  it('sameFacet compares type and id, not object identity', () => {
    expect(sameFacet(null, null)).toBe(true)
    expect(sameFacet(cat, null)).toBe(false)
    expect(sameFacet(cat, { type: 'category', id: 1 })).toBe(true)
    expect(sameFacet(cat, { type: 'category', id: 2 })).toBe(false)
    expect(sameFacet(cat, { type: 'tag', id: 1 })).toBe(false)
  })
})

describe('openFacet state machine', () => {
  let dispose: (() => void) | undefined

  beforeEach(() => {
    createRoot((d) => {
      dispose = d
      installNavigation()
      installCalendarUi()
      installFiltersSort()
    })
  })

  afterEach(() => {
    dispose?.()
    dispose = undefined
  })

  it('opens a facet without changing the current track', () => {
    expect(activeView()).toBe('today')
    goToFacet({ type: 'category', id: 3 })
    expect(openFacet()).toEqual({ type: 'category', id: 3 })
    expect(activeView()).toBe('today')
  })

  it('keeps the same facet object when opening the current destination again', () => {
    goToFacet({ type: 'category', id: 3 })
    const first = openFacet()
    goToFacet({ type: 'category', id: 3 })
    expect(openFacet()).toBe(first)
  })

  it('replaces a category with a tag', () => {
    goToFacet({ type: 'category', id: 3 })
    goToFacet({ type: 'tag', id: 7 })
    expect(openFacet()).toEqual({ type: 'tag', id: 7 })
  })

  it('clears the facet when entering a track', () => {
    goToFacet({ type: 'category', id: 3 })
    goToView('tasks')
    expect(openFacet()).toBeNull()
    expect(activeView()).toBe('tasks')
  })

  it('clears the facet from clearFilters without changing the track', () => {
    goToView('matters')
    goToFacet({ type: 'tag', id: 7 })
    clearFilters()
    expect(openFacet()).toBeNull()
    expect(activeView()).toBe('matters')
  })
})
