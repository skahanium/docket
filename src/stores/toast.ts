import { createSignal } from 'solid-js'

export interface ToastAction {
  label: string
  onClick: () => void
}

export interface Toast {
  id: string
  type: 'success' | 'error' | 'info'
  message: string
  action?: ToastAction
}

export let toasts: ReturnType<typeof createSignal<Toast[]>>[0]
export let setToasts: ReturnType<typeof createSignal<Toast[]>>[1]
export let pushToast: (type: Toast['type'], message: string, action?: ToastAction) => void
export let dismissToast: (id: string) => void

export function installToast(): void {
  ;[toasts, setToasts] = createSignal<Toast[]>([])

  dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }

  pushToast = (type: Toast['type'], message: string, action?: ToastAction) => {
    const id = crypto.randomUUID()
    setToasts((prev) => [...prev, { id, type, message, action }])
    setTimeout(() => dismissToast(id), action ? 6000 : 3000)
  }
}
