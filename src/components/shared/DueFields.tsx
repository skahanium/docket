import { type Component, Show } from 'solid-js'
import { composeDue, dueDay, dueTime } from '../../utils/date'

interface Props {
  value: string | null | undefined
  dateClass?: string
  timeClass?: string
  onChange: (next: string | null) => void
}

const DueFields: Component<Props> = (props) => {
  const day = () => dueDay(props.value) ?? ''
  const time = () => dueTime(props.value)

  const emit = (nextDay: string, nextTime: string) => {
    props.onChange(composeDue(nextDay, nextTime))
  }

  return (
    <>
      <input
        type="date"
        class={props.dateClass}
        value={day()}
        onChange={(e) => emit(e.currentTarget.value, time())}
      />
      <Show when={day()}>
        <input
          type="time"
          class={props.timeClass ?? props.dateClass}
          value={time()}
          onChange={(e) => emit(day(), e.currentTarget.value)}
        />
      </Show>
    </>
  )
}

export default DueFields
