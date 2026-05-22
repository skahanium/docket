import { createSignal } from 'solid-js'

export let calendarYear: ReturnType<typeof createSignal<number>>[0]
export let setCalendarYear: ReturnType<typeof createSignal<number>>[1]
export let calendarMonth: ReturnType<typeof createSignal<number>>[0]
export let setCalendarMonth: ReturnType<typeof createSignal<number>>[1]
export let selectedDate: ReturnType<typeof createSignal<string | null>>[0]
export let setSelectedDate: ReturnType<typeof createSignal<string | null>>[1]

export function installCalendarUi(): void {
  ;[calendarYear, setCalendarYear] = createSignal(new Date().getFullYear())
  ;[calendarMonth, setCalendarMonth] = createSignal(new Date().getMonth() + 1)
  ;[selectedDate, setSelectedDate] = createSignal<string | null>(null)
}
