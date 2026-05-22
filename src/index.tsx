/* @refresh reload */
import { ErrorBoundary } from 'solid-js'
import { render } from 'solid-js/web'
import './styles/global.css'
import App from './App.tsx'
import { bootstrapStores } from './stores'
import { waitForRuntime } from './boot'

const root = document.getElementById('root')

/** 清掉 index.html 里的启动占位，避免与 Solid 挂载内容叠在一起 */
function clearBootSplash() {
  root?.querySelector('#boot-splash')?.remove()
}

function BootError(props: { message: string }) {
  return (
    <div
      style={{
        padding: '32px',
        'font-family': 'system-ui, sans-serif',
        color: '#171717',
        'line-height': 1.6,
      }}
    >
      <h2 style={{ 'margin-bottom': '12px', color: '#e5484d' }}>应用无法启动</h2>
      <pre style={{ 'white-space': 'pre-wrap', 'font-size': '13px' }}>{props.message}</pre>
    </div>
  )
}

function reportBootError(err: unknown) {
  const message = err instanceof Error ? err.stack ?? err.message : String(err)
  console.error('[Docket boot]', err)
  if (root) {
    clearBootSplash()
    render(() => <BootError message={message} />, root)
  }
}

let storesInstalled = false

function boot() {
  if (!root) return
  clearBootSplash()

  render(
    () => {
      if (!storesInstalled) {
        storesInstalled = true
        bootstrapStores()
      }
      return (
        <ErrorBoundary
          fallback={(err) => (
            <BootError message={err instanceof Error ? err.message : String(err)} />
          )}
        >
          <App />
        </ErrorBoundary>
      )
    },
    root,
  )
}

window.addEventListener('unhandledrejection', (e) => {
  console.error('[Docket unhandled]', e.reason)
  if (!storesInstalled) {
    reportBootError(e.reason)
    e.preventDefault()
  }
})
window.addEventListener('error', (e) => {
  console.error('[Docket error]', e.error ?? e.message)
  if (!storesInstalled) {
    reportBootError(e.error ?? e.message)
  }
})

async function start() {
  try {
    await waitForRuntime()
    boot()
  } catch (err) {
    reportBootError(err)
  }
}

void start()
