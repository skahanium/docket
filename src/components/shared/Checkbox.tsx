import { type Component } from 'solid-js'
import styles from './Checkbox.module.css'

interface Props {
  checked: boolean
  onClick?: (e: MouseEvent) => void
}

const Checkbox: Component<Props> = (props) => (
  <button
    class={`${styles.checkbox} ${props.checked ? styles.checked : ''}`}
    role="checkbox"
    aria-checked={props.checked}
    aria-label={props.checked ? '已完成' : '未完成'}
    onClick={props.onClick}
  >
    {props.checked && (
      <svg class={styles.icon} viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M2 6l3 3L10 3" />
      </svg>
    )}
  </button>
)

export default Checkbox
