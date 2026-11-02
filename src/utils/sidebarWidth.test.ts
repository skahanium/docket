import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  MAIN_MIN_WIDTH,
  SIDEBAR_WIDTH_DEFAULT,
  SIDEBAR_WIDTH_KEY,
  SIDEBAR_WIDTH_MAX,
  SIDEBAR_WIDTH_MIN,
  clampSidebarPreferred,
  clampSidebarWidth,
  persistSidebarWidth,
  readStoredSidebarWidth,
  sidebarWidthMax,
} from './sidebarWidth'

describe('clampSidebarWidth', () => {
  it('keeps values inside 200–360 on a wide window', () => {
    expect(clampSidebarWidth(260, 1280)).toBe(260)
    expect(clampSidebarWidth(200, 1280)).toBe(200)
    expect(clampSidebarWidth(360, 1280)).toBe(360)
  })

  it('clamps outside the range and rejects non-finite', () => {
    expect(clampSidebarWidth(199, 1280)).toBe(SIDEBAR_WIDTH_MIN)
    expect(clampSidebarWidth(361, 1280)).toBe(SIDEBAR_WIDTH_MAX)
    expect(clampSidebarWidth(Number.NaN, 1280)).toBe(SIDEBAR_WIDTH_DEFAULT)
    expect(clampSidebarWidth(Infinity, 1280)).toBe(SIDEBAR_WIDTH_DEFAULT)
    expect(clampSidebarWidth(260.6, 1280)).toBe(261)
  })

  it('leaves the main pane at least MAIN_MIN_WIDTH', () => {
    expect(sidebarWidthMax(1280)).toBe(SIDEBAR_WIDTH_MAX)
    expect(sidebarWidthMax(700)).toBe(700 - MAIN_MIN_WIDTH)
    expect(sidebarWidthMax(600)).toBe(SIDEBAR_WIDTH_MIN)
    expect(clampSidebarWidth(360, 700)).toBe(220)
    expect(clampSidebarWidth(360, 900)).toBe(360)
    expect(clampSidebarPreferred(400)).toBe(360)
  })
})

describe('sidebar width storage', () => {
  const mem: Record<string, string> = {}

  beforeEach(() => {
    for (const k of Object.keys(mem)) delete mem[k]
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => (k in mem ? mem[k] : null),
      setItem: (k: string, v: string) => { mem[k] = v },
      removeItem: (k: string) => { delete mem[k] },
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('defaults when empty and clamps stored junk', () => {
    expect(readStoredSidebarWidth()).toBe(SIDEBAR_WIDTH_DEFAULT)
    localStorage.setItem(SIDEBAR_WIDTH_KEY, '300')
    expect(readStoredSidebarWidth()).toBe(300)
    localStorage.setItem(SIDEBAR_WIDTH_KEY, '999')
    expect(readStoredSidebarWidth()).toBe(SIDEBAR_WIDTH_MAX)
    localStorage.setItem(SIDEBAR_WIDTH_KEY, 'nope')
    expect(readStoredSidebarWidth()).toBe(SIDEBAR_WIDTH_DEFAULT)
  })

  it('persists a clamped integer', () => {
    persistSidebarWidth(180)
    expect(localStorage.getItem(SIDEBAR_WIDTH_KEY)).toBe(String(SIDEBAR_WIDTH_MIN))
    persistSidebarWidth(280)
    expect(readStoredSidebarWidth()).toBe(280)
  })
})
