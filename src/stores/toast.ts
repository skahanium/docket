import { createSignal } from 'solid-js'

export interface Toast { id: string; type: 'success' | 'error' | 'info'; message: string }

export let toasts: ReturnType<typeof createSignal<Toast[]>>[0]
export let setToasts: ReturnType<typeof createSignal<Toast[]>>[1]
export let pushToast: (type: Toast['type'], message: string) => void

export function installToast(): void {
  ;[toasts, setToasts] = createSignal<Toast[]>([])

  pushToast = (type: Toast['type'], message: string) => {
    const id = crypto.randomUUID()
    setToasts((prev) => [...prev, { id, type, message }])
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3000)
  }
}
