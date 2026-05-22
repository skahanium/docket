import { type Component, type JSX, splitProps } from 'solid-js'
import styles from './Button.module.css'

interface Props {
  variant?: 'primary' | 'secondary' | 'danger' | 'success'
  disabled?: boolean
  class?: string
  children?: JSX.Element
  onClick?: (e: MouseEvent) => void
}

const Button: Component<Props & Record<string, unknown>> = (allProps) => {
  const [props, rest] = splitProps(allProps, ['variant', 'disabled', 'class', 'children', 'onClick'])
  const v = () => props.variant ?? 'primary'
  return (
    <button
      {...rest}
      class={`${styles.btn} ${styles[v()]} ${props.class ?? ''}`}
      disabled={props.disabled}
      onClick={props.onClick}
    >
      {props.children}
    </button>
  )
}

export default Button
