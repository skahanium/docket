import { render } from 'solid-js/web'
import './styles/global.css'
import DesktopPanel from './components/DesktopPanel/DesktopPanel'

const root = document.getElementById('root')
if (root) {
  render(() => <DesktopPanel />, root)
}
