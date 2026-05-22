import { createSignal } from 'solid-js'
import { isWorkday } from '../bindings/commands'

export let reviewOpen: ReturnType<typeof createSignal<boolean>>[0]
export let setReviewOpen: ReturnType<typeof createSignal<boolean>>[1]

export function installAppChrome(): void {
  ;[reviewOpen, setReviewOpen] = createSignal(false)
}

/** 启动后延迟检查是否弹出每日回顾（原 App onMount 逻辑） */
export function scheduleDailyReviewCheck(): void {
  const checkReview = async () => {
    const today = new Date().toISOString().slice(0, 10)
    const key = `docket-review-shown-${today}`
    if (typeof localStorage !== 'undefined' && localStorage.getItem(key)) return

    const now = new Date()
    if (now.getHours() < 18) return

    try {
      const wd = await isWorkday(today)
      if (wd) {
        setReviewOpen(true)
        localStorage.setItem(key, '1')
      }
    } catch { /* ignore */ }
  }
  setTimeout(checkReview, 1500)
}
