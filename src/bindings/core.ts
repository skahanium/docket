type InvokeFn = (cmd: string, args?: Record<string, unknown>) => Promise<unknown>

let invokeImpl: InvokeFn | null = null
let invokeTestMode = false

/** Replace Tauri IPC for Vitest or non-Tauri environments. */
export function setInvokeForTests(fn: InvokeFn): void {
  invokeImpl = fn
  invokeTestMode = true
}

export function resetInvokeForTests(): void {
  invokeImpl = null
  invokeTestMode = false
}

type TauriWindow = Window & {
  isTauri?: boolean
  __TAURI_INTERNALS__?: { invoke?: InvokeFn }
  __TAURI__?: { core?: { invoke?: InvokeFn } }
}

function resolveNativeInvoke(): InvokeFn | null {
  if (typeof window === 'undefined') return null
  const w = window as TauriWindow
  const fromInternals = w.__TAURI_INTERNALS__?.invoke
  if (typeof fromInternals === 'function') return fromInternals.bind(w.__TAURI_INTERNALS__) as InvokeFn
  const fromGlobal = w.__TAURI__?.core?.invoke
  if (typeof fromGlobal === 'function') return fromGlobal.bind(w.__TAURI__?.core) as InvokeFn
  return null
}

export function isRuntimeReady(): boolean {
  if (invokeTestMode) return true
  return resolveNativeInvoke() != null
}

function getInvokeImpl(): InvokeFn {
  if (invokeImpl) return invokeImpl
  const native = resolveNativeInvoke()
  if (native) return native
  throw new Error('Tauri 运行时未就绪：请通过 Docket 桌面应用或 npm run tauri dev 启动。')
}

export function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  if (!invokeTestMode && !isRuntimeReady()) {
    return Promise.reject(
      new Error('Tauri 运行时未就绪：请通过 Docket 桌面应用打开，或使用 npm run tauri dev 启动。'),
    )
  }
  return getInvokeImpl()(cmd, args) as Promise<T>
}
