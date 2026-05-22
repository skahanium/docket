import { isRuntimeReady } from './bindings/core'

/** 等待 Tauri 注入 IPC（dev / 打包环境脚本顺序可能略晚于业务模块）。 */
export function waitForRuntime(maxMs = 4_000): Promise<void> {
  if (isRuntimeReady()) return Promise.resolve()

  return new Promise((resolve) => {
    const deadline = Date.now() + maxMs
    const tick = () => {
      if (isRuntimeReady() || Date.now() >= deadline) {
        resolve()
        return
      }
      setTimeout(tick, 4)
    }
    tick()
  })
}
