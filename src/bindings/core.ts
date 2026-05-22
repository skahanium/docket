import { invoke as tauriInvoke } from '@tauri-apps/api/core'

type InvokeFn = typeof tauriInvoke

const nativeInvoke: InvokeFn = tauriInvoke
let invokeImpl: InvokeFn = nativeInvoke

/** Replace Tauri IPC for Vitest or non-Tauri environments. */
export function setInvokeForTests(fn: InvokeFn): void {
  invokeImpl = fn
}

export function resetInvokeForTests(): void {
  invokeImpl = nativeInvoke
}

export function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  return invokeImpl(cmd, args as never) as Promise<T>
}
