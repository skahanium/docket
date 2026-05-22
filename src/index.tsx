/* @refresh reload */
import { render } from 'solid-js/web'
import { ErrorBoundary } from 'solid-js'
import './styles/global.css'
import App from './App.tsx'

const root = document.getElementById('root')

render(() => (
  <ErrorBoundary fallback={(err) => (
    <div style={{ padding: '32px', color: 'var(--danger, #e55)', 'font-family': 'system-ui' }}>
      <h2>应用出现错误</h2>
      <pre style={{ 'white-space': 'pre-wrap' }}>{String(err)}</pre>
    </div>
  )}>
    <App />
  </ErrorBoundary>
), root!)
