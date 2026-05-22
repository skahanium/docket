import { render } from 'solid-js/web'
import { ErrorBoundary } from 'solid-js'
import FocusTimer from './components/FocusTimer/FocusTimer'
import './styles/global.css'
import { waitForRuntime } from './boot'

const root = document.getElementById('root')

async function start() {
  await waitForRuntime()
  if (!root) return
  render(
    () => (
      <ErrorBoundary
        fallback={(err) => (
          <div style={{ padding: '32px', color: 'var(--danger, #e55)', 'font-family': 'system-ui' }}>
            <h2>专注计时器错误</h2>
            <pre style={{ 'white-space': 'pre-wrap' }}>{String(err)}</pre>
          </div>
        )}
      >
        <FocusTimer />
      </ErrorBoundary>
    ),
    root,
  )
}

void start()
