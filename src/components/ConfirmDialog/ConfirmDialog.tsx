import { type Component } from 'solid-js'
import styles from './ConfirmDialog.module.css'

interface Props {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  danger?: boolean
  onConfirm: () => void
  onCancel: () => void
}

const ConfirmDialog: Component<Props> = (props) => {
  if (!props.open) return null

  return (
    <div class={styles.overlay} onClick={props.onCancel} role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-msg">
      <div class={styles.dialog} onClick={(e) => e.stopPropagation()}>
        <h3 id="confirm-title" class={styles.title}>{props.title}</h3>
        <p id="confirm-msg" class={styles.message}>{props.message}</p>
        <div class={styles.actions}>
          <button class={styles.cancelBtn} onClick={props.onCancel}>取消</button>
          <button class={`${styles.confirmBtn} ${props.danger ? styles.danger : ''}`} onClick={props.onConfirm}>
            {props.confirmLabel ?? '确认'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default ConfirmDialog
