import { render } from 'solid-js/web'
import './styles/global.css'
import './styles/panel-window.css'
import DesktopPanel from './components/DesktopPanel/DesktopPanel'
import { waitForRuntime } from './boot'
import { installCrossWindowThemeSync } from './utils/themeSync'
import { markDocumentPlatform } from './utils/platform'

const root = document.getElementById('root')

async function start() {
  markDocumentPlatform()
  await waitForRuntime()
  const disposeTheme = installCrossWindowThemeSync()
  if (root) {
    render(() => <DesktopPanel />, root)
    window.addEventListener('beforeunload', disposeTheme, { once: true })
  }
}

void start()
