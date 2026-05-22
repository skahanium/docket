import { type Component, splitProps } from 'solid-js'
import styles from './Input.module.css'

interface Props {
  value?: string
  placeholder?: string
  disabled?: boolean
  class?: string
  autofocus?: boolean
  onInput?: (e: InputEvent) => void
  onKeyDown?: (e: KeyboardEvent) => void
  onBlur?: (e: FocusEvent) => void
}

const Input: Component<Props & Record<string, unknown>> = (allProps) => {
  const [props, rest] = splitProps(allProps, ['class'])
  return <input {...rest} class={`${styles.input} ${props.class ?? ''}`} />
}

export default Input
